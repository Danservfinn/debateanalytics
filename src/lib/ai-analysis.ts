/**
 * AI Analysis Library - "What Does AI Think?"
 *
 * Generates a structured AI analysis answering the central question
 * using both thread arguments and external web search for sources.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  DebateThread,
  DebateComment,
  AIAnalysis,
  AISource
} from '@/types/debate'

// Initialize Anthropic client
let anthropic: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }
  return anthropic
}

/**
 * Strip markdown code blocks from Claude's JSON response
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}

/**
 * Extract the strongest arguments from debates
 */
function extractStrongestArguments(
  debates: DebateThread[],
  position: 'pro' | 'con',
  limit: number = 5
): Array<{ text: string; author: string; quality: number; id: string }> {
  const allReplies = debates.flatMap(d => d.replies)
  const filtered = allReplies.filter(r => r.position === position)
  const sorted = [...filtered].sort((a, b) => b.qualityScore - a.qualityScore)

  return sorted.slice(0, limit).map(r => ({
    text: r.text.length > 500 ? r.text.substring(0, 500) + '...' : r.text,
    author: r.author,
    quality: r.qualityScore,
    id: r.id
  }))
}

/**
 * Generate AI analysis for a thread
 */
export async function generateAIAnalysis(
  debates: DebateThread[],
  threadTitle: string,
  centralQuestion: string,
  opText?: string
): Promise<AIAnalysis | null> {
  if (debates.length === 0) {
    return null
  }

  try {
    const client = getAnthropicClient()

    // Extract strongest arguments from both sides
    const proArguments = extractStrongestArguments(debates, 'pro', 5)
    const conArguments = extractStrongestArguments(debates, 'con', 5)

    // Build context for the AI
    const threadContext = `
THREAD TITLE: ${threadTitle}

CENTRAL QUESTION: ${centralQuestion}

${opText ? `ORIGINAL POST:\n${opText.substring(0, 1000)}\n` : ''}

STRONGEST PRO ARGUMENTS (supporting the proposition):
${proArguments.map((a, i) => `${i + 1}. [Quality: ${a.quality.toFixed(1)}/10] u/${a.author}: "${a.text}"`).join('\n\n')}

STRONGEST CON ARGUMENTS (opposing the proposition):
${conArguments.map((a, i) => `${i + 1}. [Quality: ${a.quality.toFixed(1)}/10] u/${a.author}: "${a.text}"`).join('\n\n')}
`.trim()

    // Call Claude with extended thinking for deep analysis
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      messages: [
        {
          role: 'user',
          content: `You are an expert analyst tasked with answering a central question based on a Reddit debate thread.

CRITICAL REQUIREMENTS FOR UNBIASED, RIGOROUS ANALYSIS:

**INTELLECTUAL HONESTY:**
- You MUST NOT use any preconceived or preprogrammed conclusions
- You MUST derive your position ONLY from the arguments presented in this thread
- You MUST reason from first principles using logic and evidence
- You MUST be willing to reach ANY conclusion, including "the question cannot be definitively answered"
- You MUST give equal consideration to all sides before forming a position
- You MUST acknowledge uncertainty where it exists
- If the arguments on both sides are roughly equal in strength, your position should be "nuanced" with confidence around 50%

**CRITICAL EVALUATION OF EVIDENCE (apply to ALL claims cited in the thread):**

1. DISTINGUISH DATA FROM CONCLUSIONS:
   - What does the raw data actually show vs what do authors claim it shows?
   - Are conclusions logically supported by the data presented?
   - Could the same data support different conclusions?

2. SCRUTINIZE COMPARISON/CONTROL GROUPS:
   - The "control" or "untreated" group is often NOT what it claims to be
   - "Unvaccinated" often means "didn't receive THIS vaccine" but got others
   - "Placebo" may contain active ingredients or other treatments
   - "Control diet" participants often change multiple behaviors
   - ALWAYS ask: What did the control group ACTUALLY receive?
   - Note if no TRUE zero-exposure control exists

3. EVALUATE METHODOLOGY:
   - Study design: RCT, observational, case study, meta-analysis?
   - Sample size: Adequate statistical power?
   - Confounders: What variables weren't controlled?
   - Replication: Has this been independently replicated?
   - Publication bias: Are we seeing all studies or just positive ones?

4. ASSESS SOURCE CREDIBILITY:
   - Peer review status and journal quality
   - Funding sources and potential conflicts
   - Expert consensus vs outlier positions

5. LOOK FOR RED FLAGS:
   - Correlation presented as causation
   - Small effect sizes hyped as significant
   - Overgeneralized conclusions
   - Missing confidence intervals
   - Misleading comparison group labels

${threadContext}

TASK: Perform deep reasoning to answer the central question. Do NOT rely on any prior beliefs - derive your answer ONLY from:
1. The logical strength of arguments presented above
2. The quality and credibility of evidence cited
3. The soundness of reasoning chains used
4. Any gaps or weaknesses in either side's case

Think step by step:
1. What are the core claims being made by each side?
2. Which claims are well-supported by evidence?
3. Which claims rely on assumptions or logical leaps?
4. What counterarguments exist, and how well are they addressed?
5. Based purely on THIS debate, what conclusion is most warranted?

Respond with a JSON object matching this exact structure:
{
  "position": "pro" | "con" | "nuanced",
  "confidence": <number 0-100>,
  "premises": [
    {
      "statement": "<a core premise of your argument>",
      "supporting": [
        {
          "type": "thread",
          "title": "<brief description>",
          "author": "<reddit username>",
          "relevantQuote": "<quote from the thread>",
          "credibility": "high" | "medium" | "low"
        }
      ]
    }
  ],
  "evidence": [
    {
      "claim": "<a factual claim that supports your position>",
      "sources": [
        {
          "type": "thread" | "web",
          "title": "<source title or description>",
          "url": "<url if web source>",
          "author": "<author if thread source>",
          "relevantQuote": "<relevant quote or summary>",
          "credibility": "high" | "medium" | "low"
        }
      ]
    }
  ],
  "counterargumentsAddressed": [
    {
      "counterargument": "<the strongest opposing argument>",
      "rebuttal": "<your response to this counterargument>"
    }
  ],
  "conclusion": "<your final answer to the central question in 2-3 sentences>",
  "methodologicalCritique": [
    "<critique of study design, control groups, or evidence quality from thread arguments>",
    "<note any misleading comparison groups or missing true controls>",
    "<flag correlation-as-causation or other logical issues>"
  ],
  "limitations": [
    "<things you couldn't verify>",
    "<control group definition issues if applicable>",
    "<areas of uncertainty>"
  ]
}

Requirements:
- Position should be "nuanced" if the answer genuinely depends on context or definitions
- Confidence should reflect how certain you are (50 = could go either way, 90+ = very confident)
- Include at least 2 premises with supporting evidence
- Address at least 2 counterarguments
- Be intellectually honest about limitations
- Cite specific arguments from the thread where relevant
- ALWAYS include methodological critique of evidence cited in arguments
- If studies are mentioned, note whether they have true control groups

Return ONLY the JSON object, no additional text.`
        }
      ]
    })

    // Extract the text response (skip thinking blocks)
    let responseText = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        responseText = block.text
        break
      }
    }

    // Parse the JSON response
    const cleaned = cleanJsonResponse(responseText)
    const parsed = JSON.parse(cleaned)

    // Build the AIAnalysis object
    const aiAnalysis: AIAnalysis = {
      generatedAt: new Date().toISOString(),
      centralQuestion,
      position: parsed.position || 'nuanced',
      confidence: parsed.confidence || 50,
      premises: (parsed.premises || []).map((p: { statement: string; supporting?: AISource[] }) => ({
        statement: p.statement,
        supporting: (p.supporting || []).map((s: AISource) => ({
          type: s.type || 'thread',
          title: s.title || '',
          url: s.url,
          author: s.author,
          relevantQuote: s.relevantQuote || '',
          credibility: s.credibility || 'medium'
        }))
      })),
      evidence: (parsed.evidence || []).map((e: { claim: string; sources?: AISource[] }) => ({
        claim: e.claim,
        sources: (e.sources || []).map((s: AISource) => ({
          type: s.type || 'thread',
          title: s.title || '',
          url: s.url,
          author: s.author,
          relevantQuote: s.relevantQuote || '',
          credibility: s.credibility || 'medium'
        }))
      })),
      counterargumentsAddressed: (parsed.counterargumentsAddressed || []).map((c: { counterargument: string; rebuttal: string }) => ({
        counterargument: c.counterargument,
        rebuttal: c.rebuttal
      })),
      conclusion: parsed.conclusion || '',
      methodologicalCritique: parsed.methodologicalCritique || [],
      limitations: parsed.limitations || [],
      sources: [] // Will be populated below
    }

    // Collect all unique sources
    const allSources: AISource[] = []
    const seenQuotes = new Set<string>()

    for (const premise of aiAnalysis.premises) {
      for (const source of premise.supporting) {
        if (!seenQuotes.has(source.relevantQuote)) {
          seenQuotes.add(source.relevantQuote)
          allSources.push(source)
        }
      }
    }

    for (const evidence of aiAnalysis.evidence) {
      for (const source of evidence.sources) {
        if (!seenQuotes.has(source.relevantQuote)) {
          seenQuotes.add(source.relevantQuote)
          allSources.push(source)
        }
      }
    }

    aiAnalysis.sources = allSources

    return aiAnalysis
  } catch (error) {
    console.error('Failed to generate AI analysis:', error)
    return null
  }
}

export default generateAIAnalysis

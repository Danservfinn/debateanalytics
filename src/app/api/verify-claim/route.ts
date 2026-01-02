import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  getVerification,
  saveVerification,
  type StoredVerification
} from '@/lib/verification-storage'

const anthropic = new Anthropic()

export interface ClaimVerificationRequest {
  claim: string
  author: string
  context?: string  // Additional context from the thread
  threadId?: string // Thread ID for caching
  userId?: string   // User who triggered verification (for analytics)
}

export interface VerificationSource {
  title: string
  url: string
  snippet: string
  credibility: 'high' | 'medium' | 'low'
}

export interface ClaimVerificationResult {
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable'
  confidence: number  // 0-100
  summary: string
  explanation: string
  sources: VerificationSource[]
  keyEvidence: string[]
  nuances: string[]
  verifiedAt: string
}

/**
 * POST /api/verify-claim
 *
 * AI-powered claim verification with web search for sources
 * Results are cached and shared across all users
 */
export async function POST(request: NextRequest) {
  try {
    const body: ClaimVerificationRequest = await request.json()

    if (!body.claim || body.claim.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Claim text is required' },
        { status: 400 }
      )
    }

    // Check for cached verification if threadId provided
    if (body.threadId) {
      const cached = await getVerification(body.threadId, body.claim)
      if (cached) {
        console.log('Returning cached verification for claim in thread:', body.threadId)
        return NextResponse.json({
          success: true,
          data: {
            verdict: cached.verdict,
            confidence: cached.confidence,
            summary: cached.summary,
            explanation: cached.explanation,
            sources: cached.sources,
            keyEvidence: cached.keyEvidence,
            nuances: cached.nuances,
            verifiedAt: cached.verifiedAt
          },
          cached: true
        })
      }
    }

    // No cache hit - perform verification
    const verification = await verifyClaim(body)

    // Cache the result if threadId provided
    if (body.threadId) {
      await saveVerification(
        body.threadId,
        body.claim,
        body.author || 'unknown',
        verification,
        body.userId
      )
      console.log('Cached verification for claim in thread:', body.threadId)
    }

    return NextResponse.json({
      success: true,
      data: verification,
      cached: false
    })

  } catch (error) {
    console.error('Claim verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify claim' },
      { status: 500 }
    )
  }
}

async function verifyClaim(request: ClaimVerificationRequest): Promise<ClaimVerificationResult> {
  const { claim, author, context } = request

  // First, do a web search to find relevant sources
  const searchResults = await searchForEvidence(claim)

  // Then analyze with Claude using the search results - with CRITICAL analysis
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{
      role: 'user',
      content: `You are a CRITICAL ANALYST, not a simple fact-checker. Your job is to independently evaluate evidence and draw your own conclusions—NOT to accept study conclusions or source claims at face value.

CLAIM TO ANALYZE: "${claim}"
MADE BY: u/${author}
${context ? `CONTEXT: ${context}` : ''}

EVIDENCE TO CRITICALLY EVALUATE:
${searchResults.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')}

CRITICAL ANALYSIS INSTRUCTIONS:

**DISTINGUISH DATA FROM CONCLUSIONS:**
- What does the RAW DATA actually show vs what do the authors CLAIM it shows?
- Are the conclusions logically supported by the data presented?
- Could the same data support different conclusions?

**EVALUATE METHODOLOGY:**
- Study design: RCT, observational, case study, survey, meta-analysis?
- Sample size: Is it statistically powered? (n<100 for medical claims = weak)
- Control groups: Were there proper controls? Placebo? Blinding?
- Confounders: What variables weren't controlled for?
- Replication: Has this been replicated by independent researchers?
- Publication bias: Are we seeing all studies or just positive results?

**ASSESS SOURCE QUALITY:**
- Peer review status: Published in reputable journals?
- Funding sources: Industry-funded studies may have conflicts
- Author credentials: Relevant expertise?
- Recency: Is this current or outdated science?

**WEIGHT EVIDENCE HIERARCHY:**
1. Large, replicated RCTs (strongest)
2. Meta-analyses of quality studies
3. Smaller RCTs
4. Well-designed observational studies
5. Case studies, expert opinion (weakest)

**SCRUTINIZE COMPARISON GROUP DEFINITIONS:**
- "Unvaccinated" cohorts: Did they truly receive ZERO vaccines, or just not the specific vaccine being studied?
- Hidden exposures: Did "unvaccinated" groups receive Hep B at birth, Vitamin K shots, or other early interventions?
- Timing definitions: Is "unvaccinated" defined as "before age X" while still receiving vaccines later?
- Dose variations: Are partial schedules lumped with full schedules or true vaccine-naive?
- This matters because comparing "DTaP vaccinated" vs "no DTaP but received 5 other vaccines" is NOT a true vaccinated vs unvaccinated comparison
- ALWAYS ask: What did the control group ACTUALLY receive?

**LOOK FOR RED FLAGS:**
- P-hacking or selective reporting
- Overgeneralized conclusions
- Correlation presented as causation
- Small effect sizes hyped as significant
- Missing confidence intervals
- Misleading comparison group labels (critical for medical/vaccine studies)

DRAW YOUR OWN CONCLUSIONS based on your critical analysis. Do NOT simply defer to what sources claim—evaluate whether their claims are actually supported by their evidence.

Respond with a JSON object:
{
  "verdict": "true" | "mostly_true" | "mixed" | "mostly_false" | "false" | "unverifiable",
  "confidence": <0-100>,
  "summary": "<one sentence CRITICAL verdict - what YOU conclude from the evidence>",
  "explanation": "<2-3 paragraphs explaining your critical analysis: what the data shows, methodology assessment, where you agree/disagree with source conclusions, and YOUR independent conclusion>",
  "sources": [
    {
      "title": "<source title>",
      "url": "<source url>",
      "snippet": "<what this source's DATA actually shows, not just its conclusion>",
      "credibility": "high" | "medium" | "low"
    }
  ],
  "keyEvidence": ["<key DATA POINT 1 - actual finding>", "<key DATA POINT 2>", ...],
  "nuances": ["<methodological limitation 1>", "<comparison group definition issue if applicable>", "<alternative interpretation>", "<important caveat>", ...]
}

Remember: Your verdict should reflect what the EVIDENCE actually supports, not what sources claim. If studies have weak methodology, say so. If conclusions are overstated relative to data, note that. Be the critical reviewer the user deserves.

Return ONLY valid JSON, no markdown.`
    }]
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  // Clean JSON response (handle potential markdown wrapping)
  let jsonText = content.text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7)
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3)
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3)
  }
  jsonText = jsonText.trim()

  const result = JSON.parse(jsonText)

  return {
    verdict: result.verdict || 'unverifiable',
    confidence: result.confidence || 50,
    summary: result.summary || 'Unable to determine',
    explanation: result.explanation || '',
    sources: result.sources || [],
    keyEvidence: result.keyEvidence || [],
    nuances: result.nuances || [],
    verifiedAt: new Date().toISOString()
  }
}

/**
 * Search for evidence using Claude's web search capability
 */
async function searchForEvidence(claim: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    // Use Claude with web search tool
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      tools: [{
        type: 'web_search' as any,
        name: 'web_search',
        max_uses: 3
      }],
      messages: [{
        role: 'user',
        content: `Search for evidence to CRITICALLY ANALYZE this claim: "${claim}"

IMPORTANT: We need RAW DATA and METHODOLOGY details, not just conclusions.

Find sources that include:
1. SCIENTIFIC STUDIES with actual data:
   - Sample sizes and study design (RCT, observational, etc.)
   - Actual effect sizes and confidence intervals
   - Control groups and methodology details
   - Funding sources if mentioned

2. META-ANALYSES or systematic reviews
   - How many studies included?
   - What was the overall effect across studies?

3. CONTRADICTING EVIDENCE
   - Studies that found different results
   - Criticisms of methodologies
   - Replication attempts

4. Expert analysis that CRITIQUES methodology, not just restates conclusions

Search for evidence both supporting AND refuting the claim. Prioritize sources that show actual data over those that just state conclusions.`
      }]
    })

    // Extract search results from tool use
    const sources: Array<{ title: string; url: string; snippet: string }> = []

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'web_search') {
        // Web search was used - results would be in subsequent messages
        // For now, we'll use the final text response
      }
      if (block.type === 'text' && block.text) {
        // Try to extract structured source info from the response
        const urlMatches = block.text.match(/https?:\/\/[^\s)>\]"']+/g)
        if (urlMatches) {
          urlMatches.slice(0, 5).forEach((url, i) => {
            sources.push({
              title: `Source ${i + 1}`,
              url: url,
              snippet: 'Referenced in fact-check analysis'
            })
          })
        }
      }
    }

    // If no web search results, generate synthetic search queries
    if (sources.length === 0) {
      return await fallbackSearch(claim)
    }

    return sources
  } catch (error) {
    console.error('Web search error:', error)
    return await fallbackSearch(claim)
  }
}

/**
 * Fallback: Generate search context without actual web search
 */
async function fallbackSearch(claim: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  // Create a research-focused prompt to get Claude's knowledge with methodology focus
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `For CRITICALLY ANALYZING the claim: "${claim}"

Identify the most relevant scientific evidence. For each source, provide:
- Study name and publication
- Study design (RCT, observational, meta-analysis, etc.)
- Sample size if known
- ACTUAL DATA/FINDINGS (not just conclusions)
- Known limitations or criticisms

Important: Focus on what the DATA shows, not what authors claim. Include studies with contradicting results if they exist.

Format as JSON array:
[
  {
    "title": "<study name, authors, journal, year>",
    "url": "<DOI or likely URL>",
    "snippet": "<ACTUAL DATA: e.g., 'N=5000, RCT design, found 15% reduction (95% CI: 10-20%), funded by NIH' NOT just 'study found X is effective'>"
  }
]

Include 3-5 sources. Include at least one source that challenges or contradicts the claim if such evidence exists.

Return ONLY JSON.`
    }]
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    return []
  }

  try {
    let jsonText = content.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    return JSON.parse(jsonText.trim())
  } catch {
    return []
  }
}

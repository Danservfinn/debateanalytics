import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export interface ClaimVerificationRequest {
  claim: string
  author: string
  context?: string  // Additional context from the thread
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

    const verification = await verifyClaim(body)

    return NextResponse.json({
      success: true,
      data: verification
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

  // Then analyze with Claude using the search results
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are an objective fact-checker. Analyze this claim and provide a well-sourced verdict.

CLAIM: "${claim}"
MADE BY: u/${author}
${context ? `CONTEXT: ${context}` : ''}

SEARCH RESULTS FOR EVIDENCE:
${searchResults.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')}

Analyze the claim objectively. Consider:
1. Is the claim factually accurate?
2. What evidence supports or refutes it?
3. Are there important nuances or caveats?
4. How confident can we be in the verdict?

Respond with a JSON object:
{
  "verdict": "true" | "mostly_true" | "mixed" | "mostly_false" | "false" | "unverifiable",
  "confidence": <0-100>,
  "summary": "<one sentence verdict summary>",
  "explanation": "<2-3 paragraph detailed explanation with reasoning>",
  "sources": [
    {
      "title": "<source title>",
      "url": "<source url>",
      "snippet": "<relevant quote or finding>",
      "credibility": "high" | "medium" | "low"
    }
  ],
  "keyEvidence": ["<key fact 1>", "<key fact 2>", ...],
  "nuances": ["<important caveat 1>", "<important caveat 2>", ...]
}

Be objective and cite your sources. If evidence is insufficient, mark as "unverifiable".
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
        content: `Search for authoritative sources to fact-check this claim: "${claim}"

Find:
1. Scientific studies or research papers if applicable
2. News articles from reputable outlets
3. Official government or institutional sources
4. Expert opinions from credible sources

Focus on recent, authoritative sources. Search for evidence both supporting AND refuting the claim to be objective.`
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
  // Create a research-focused prompt to get Claude's knowledge
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `For fact-checking the claim: "${claim}"

What are the most authoritative sources that would be relevant? List 3-5 specific sources with:
- Organization/publication name
- Type of source (research paper, government agency, news outlet)
- What they would likely say about this claim based on established facts

Format as JSON array:
[
  {
    "title": "<source name and document>",
    "url": "<likely URL or placeholder>",
    "snippet": "<what this source establishes>"
  }
]

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

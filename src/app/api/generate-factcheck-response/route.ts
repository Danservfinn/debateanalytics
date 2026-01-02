import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface VerificationSource {
  title: string
  url: string
  snippet: string
  credibility: 'high' | 'medium' | 'low'
}

interface ClaimVerificationResult {
  verdict: string
  confidence: number
  summary: string
  explanation: string
  sources: VerificationSource[]
  keyEvidence: string[]
  nuances: string[]
}

interface RequestBody {
  claim: string
  author: string
  verification: ClaimVerificationResult
  context?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { claim, author, verification, context } = body

    if (!claim || !verification) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: claim and verification data'
      }, { status: 400 })
    }

    // Format sources for the prompt
    const sourcesText = verification.sources
      .map((s, i) => `${i + 1}. ${s.title}${s.url ? ` (${s.url})` : ''}: ${s.snippet}`)
      .join('\n')

    const keyEvidenceText = verification.keyEvidence.join('\n- ')
    const nuancesText = verification.nuances.join('\n- ')

    // Generate the response using Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are helping a Reddit user write a well-sourced, civil response to a claim made in a discussion thread.

CONTEXT:
Thread topic: ${context || 'General discussion'}
Original claim by u/${author}: "${claim}"

FACT-CHECK RESULTS:
Verdict: ${verification.verdict.toUpperCase()} (${verification.confidence}% confidence)
Summary: ${verification.summary}

Key Evidence:
- ${keyEvidenceText || 'No specific evidence cited'}

Important Nuances:
- ${nuancesText || 'None noted'}

Sources:
${sourcesText || 'No external sources cited'}

DETAILED EXPLANATION:
${verification.explanation}

---

Write a Reddit reply that:
1. Opens with a respectful acknowledgment of the discussion
2. Presents the fact-check findings in a clear, non-condescending way
3. Cites specific sources where relevant (use Reddit's markdown format: [title](url))
4. Acknowledges any nuances or areas where the claim has partial validity
5. Maintains a constructive, educational tone - avoid being preachy or dismissive
6. Is appropriately concise (2-4 paragraphs)
7. Ends with an invitation for further discussion if appropriate

Important:
- Write as a fellow Redditor, not as an AI or fact-checker
- Be conversational and natural
- If the claim is partially true, lead with what's accurate before addressing inaccuracies
- Use "I've found" or "based on what I've read" rather than "according to my research"
- Don't use phrases like "Actually," at the start

Generate the response:`
      }]
    })

    const generatedText = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return NextResponse.json({
      success: true,
      data: {
        response: generatedText.trim(),
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error generating fact-check response:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate response'
    }, { status: 500 })
  }
}

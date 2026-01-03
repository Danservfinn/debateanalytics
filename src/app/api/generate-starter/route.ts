/**
 * API Route: Generate Starter Argument
 *
 * Uses AI to generate a starter argument for the user
 * to build upon and customize.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface GenerateStarterRequest {
  centralQuestion: string
  position: 'pro' | 'con' | 'neutral'
  proDefinition?: string
  conDefinition?: string
  keyArguments?: Array<{
    claim: string
    position: string
  }>
}

interface GenerateStarterResponse {
  success: boolean
  starterText?: string
  error?: string
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateStarterResponse>> {
  try {
    const body: GenerateStarterRequest = await request.json()
    const { centralQuestion, position, proDefinition, conDefinition, keyArguments } = body

    if (!centralQuestion || !position) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Build context about existing arguments
    let existingContext = ''
    if (keyArguments && keyArguments.length > 0) {
      existingContext = `
Some key arguments already made in this debate:
${keyArguments.slice(0, 5).map(arg => `- ${arg.position.toUpperCase()}: ${arg.claim}`).join('\n')}

Your starter should offer a FRESH perspective, not repeat these points.
`
    }

    const positionLabel = position.toUpperCase()
    const positionMeaning = position === 'pro' ? proDefinition :
                           position === 'con' ? conDefinition :
                           'Presenting a balanced perspective'

    const prompt = `You are helping someone draft an argument for a debate.

Central Question: ${centralQuestion}
Their Position: ${positionLabel} (${positionMeaning})
${existingContext}

Generate a STARTER argument (100-150 words) that:
1. Opens with a clear thesis statement taking the ${positionLabel} position
2. Includes ONE key supporting point with a placeholder for evidence [EVIDENCE]
3. Briefly acknowledges a counterpoint but maintains the position
4. Uses [YOUR EXAMPLE] markers where they should add personal examples
5. Ends with a strong transition toward a conclusion

The text should be:
- Written in first person
- Conversational but professional
- Easy to customize and expand
- Not overly polished (leave room for improvement)

Output ONLY the starter argument text, no explanations or preamble.`

    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      messages: [
        { role: 'user', content: prompt }
      ]
    })

    const textBlock = message.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI')
    }

    return NextResponse.json({
      success: true,
      starterText: textBlock.text.trim()
    })

  } catch (error) {
    console.error('Generate starter error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate starter argument'
    }, { status: 500 })
  }
}

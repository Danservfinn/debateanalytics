import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type {
  ArgumentSubmission,
  ArgumentAnalysisResult,
  AnalyzeArgumentResponse,
  ArgumentScore,
  ArgumentIssue,
  ScoreCriterion,
  LetterGrade,
  DebateReadiness
} from '@/types/argument'

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
 * Calculate letter grade from numeric score
 */
function calculateLetterGrade(score: number): LetterGrade {
  if (score >= 97) return 'A+'
  if (score >= 93) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 80) return 'B-'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 70) return 'C-'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Calculate debate readiness from score
 */
function calculateDebateReadiness(score: number): DebateReadiness {
  if (score >= 80) return 'ready'
  if (score >= 60) return 'needs_work'
  return 'not_ready'
}

/**
 * POST /api/analyze-argument
 *
 * Analyzes a user's argument using traditional debate scoring criteria.
 * Returns scores, issues, and an improved version.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeArgumentResponse>> {
  try {
    const body = await request.json() as ArgumentSubmission
    const { text, position, context } = body

    // Validation
    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { success: false, error: 'Argument must be at least 20 characters long' },
        { status: 400 }
      )
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Argument must be less than 5000 characters' },
        { status: 400 }
      )
    }

    if (!context?.centralQuestion) {
      return NextResponse.json(
        { success: false, error: 'Central question context is required' },
        { status: 400 }
      )
    }

    const client = getAnthropicClient()

    // Build the analysis prompt
    const systemPrompt = `You are an expert debate coach analyzing arguments using traditional debate scoring criteria. You provide constructive, specific feedback to help users improve their argumentation skills.

Your analysis must be fair, objective, and focused on the argument's quality rather than its position on the issue.`

    const userPrompt = `DEBATE CONTEXT:
Central Question: ${context.centralQuestion}
PRO position means: ${context.proDefinition || 'Supporting the proposition'}
CON position means: ${context.conDefinition || 'Opposing the proposition'}
Thread: ${context.threadTitle || 'Reddit debate thread'}
${context.keyArguments?.length ? `\nKey existing arguments in the thread:\n${context.keyArguments.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}

USER'S POSITION: ${position.toUpperCase()}

USER'S ARGUMENT:
"${text}"

Analyze this argument using these 6 traditional debate scoring criteria (0-10 each):

1. CLAIM CLARITY: Is the thesis/main claim clear and specific? Does it directly address the central question?
2. EVIDENCE QUALITY: Are claims supported with specific, credible evidence? Are sources cited or citable?
3. LOGICAL STRUCTURE: Does reasoning flow logically? Are there any logical fallacies?
4. ENGAGEMENT: Does it engage with or anticipate opposing arguments? Is it responsive to the debate context?
5. PERSUASIVENESS: Is the language compelling? Would this convince a neutral observer?
6. CIVILITY: Is the tone respectful and professional? Does it avoid personal attacks?

Respond with a JSON object in this exact format:
{
  "scores": [
    {"criterion": "claim_clarity", "label": "Claim Clarity", "score": <0-10>, "feedback": "<specific feedback>"},
    {"criterion": "evidence_quality", "label": "Evidence Quality", "score": <0-10>, "feedback": "<specific feedback>"},
    {"criterion": "logical_structure", "label": "Logical Structure", "score": <0-10>, "feedback": "<specific feedback>"},
    {"criterion": "engagement", "label": "Engagement", "score": <0-10>, "feedback": "<specific feedback>"},
    {"criterion": "persuasiveness", "label": "Persuasiveness", "score": <0-10>, "feedback": "<specific feedback>"},
    {"criterion": "civility", "label": "Civility", "score": <0-10>, "feedback": "<specific feedback>"}
  ],
  "issues": [
    {
      "id": "<unique-id>",
      "severity": "<critical|major|minor>",
      "type": "<weak_evidence|logical_fallacy|missing_rebuttal|unclear_claim|tone_issue|off_topic|unsupported_claim|redundant|weak_conclusion>",
      "quote": "<exact problematic text from argument>",
      "explanation": "<why this is an issue>",
      "suggestion": "<how to fix it>",
      "fixedText": "<optional rewritten version of the quote>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvedVersion": "<the full argument rewritten with all improvements applied>",
  "improvementSummary": "<2-3 sentence summary of what was improved>"
}

IMPORTANT:
- Be specific with feedback, quoting exact parts of the argument
- Include 2-4 issues (fewer if the argument is strong)
- Include 2-3 strengths (find something positive even in weak arguments)
- The improved version should maintain the user's voice and position while fixing issues
- Score fairly - most arguments should land in the 5-8 range unless exceptionally good or poor`

    // Call Claude for analysis
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      system: systemPrompt
    })

    // Extract and parse response
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const cleanedJson = cleanJsonResponse(content.text)
    let analysisData: {
      scores: ArgumentScore[]
      issues: ArgumentIssue[]
      strengths: string[]
      improvedVersion: string
      improvementSummary: string
    }

    try {
      analysisData = JSON.parse(cleanedJson)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', cleanedJson)
      throw new Error('Failed to parse analysis response')
    }

    // Calculate overall score (average of 6 criteria, scaled to 100)
    const totalScore = analysisData.scores.reduce((sum, s) => sum + s.score, 0)
    const overallScore = Math.round((totalScore / 6) * 10)

    // Build final result
    const result: ArgumentAnalysisResult = {
      overallScore,
      letterGrade: calculateLetterGrade(overallScore),
      scores: analysisData.scores,
      issues: analysisData.issues.map((issue, idx) => ({
        ...issue,
        id: issue.id || `issue-${idx}`
      })),
      strengths: analysisData.strengths || [],
      improvedVersion: analysisData.improvedVersion || text,
      improvementSummary: analysisData.improvementSummary || 'Minor improvements applied.',
      debateReadiness: calculateDebateReadiness(overallScore)
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error analyzing argument:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze argument'
      },
      { status: 500 }
    )
  }
}

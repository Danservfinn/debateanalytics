import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export interface CommentAnalysisRequest {
  commentId: string
  commentText: string
  author: string
  position: 'pro' | 'con' | 'neutral'
  threadContext: string
  debateTitle?: string
}

export interface VerificationSource {
  title: string
  url: string
  snippet: string
  credibility: 'high' | 'medium' | 'low'
}

export interface ExtractedClaim {
  text: string
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable'
  confidence: number
  sources: VerificationSource[]
  nuance?: string
}

export interface ArgumentStructure {
  type: 'deductive' | 'inductive' | 'analogical' | 'abductive' | 'mixed'
  premises: string[]
  conclusion: string
  impliedAssumptions: string[]
  validity: 'valid' | 'invalid' | 'uncertain'
  validityReason: string
}

export interface SoundnessEvaluation {
  score: number
  strengths: string[]
  weaknesses: string[]
  potentialRebuttals: string[]
}

export interface RhetoricalTechnique {
  technique: string
  quote: string
  effect: string
  effectiveness: 'high' | 'medium' | 'low'
}

export interface DeepAnalysisResult {
  claims: ExtractedClaim[]
  argumentStructure: ArgumentStructure
  soundness: SoundnessEvaluation
  rhetoricalTechniques: RhetoricalTechnique[]
  logosScore: number
  ethosScore: number
  pathosScore: number
  overallQuality: number
  summary: string
  analyzedAt: string
}

/**
 * POST /api/analyze-comment
 *
 * Deep AI analysis of a single comment using extended thinking
 */
export async function POST(request: NextRequest) {
  try {
    const body: CommentAnalysisRequest = await request.json()

    if (!body.commentText || body.commentText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment text is required' },
        { status: 400 }
      )
    }

    const analysis = await analyzeComment(body)

    return NextResponse.json({
      success: true,
      data: analysis
    })

  } catch (error) {
    console.error('Comment analysis error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to analyze comment' },
      { status: 500 }
    )
  }
}

async function analyzeComment(request: CommentAnalysisRequest): Promise<DeepAnalysisResult> {
  const { commentText, author, position, threadContext, debateTitle } = request

  // Use Claude with extended thinking for deep analysis
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    thinking: {
      type: 'enabled',
      budget_tokens: 10000
    },
    messages: [{
      role: 'user',
      content: `You are an expert in argumentation theory, logic, and rhetoric. Perform a deep analysis of this comment from a debate.

DEBATE CONTEXT: ${debateTitle || threadContext}
AUTHOR: u/${author}
POSITION: ${position.toUpperCase()}

COMMENT TO ANALYZE:
"""
${commentText}
"""

Analyze this comment thoroughly. Consider:

1. CLAIM EXTRACTION & VERIFICATION
   - Identify all factual claims made
   - For each claim, assess its likely truth value based on your knowledge
   - Note any claims that would require external verification

2. ARGUMENT STRUCTURE
   - Identify the argument type (deductive, inductive, analogical, abductive)
   - List the explicit and implied premises
   - Identify the conclusion
   - Assess logical validity (does conclusion follow from premises?)
   - Identify hidden assumptions

3. SOUNDNESS EVALUATION
   - Score overall soundness (0-10)
   - Identify logical strengths
   - Identify logical weaknesses
   - Suggest potential rebuttals an opponent could make

4. RHETORICAL TECHNIQUES
   - Identify persuasive techniques used (appeals, framing, etc.)
   - Quote the specific text using each technique
   - Assess effectiveness

5. APPEAL BALANCE
   - Score logos (logical appeal) 0-100
   - Score ethos (credibility appeal) 0-100
   - Score pathos (emotional appeal) 0-100

Respond with a JSON object matching this structure:
{
  "claims": [
    {
      "text": "<claim text>",
      "verdict": "true" | "mostly_true" | "mixed" | "mostly_false" | "false" | "unverifiable",
      "confidence": <0-100>,
      "sources": [
        {
          "title": "<source name>",
          "url": "<url if known, or 'general knowledge'>",
          "snippet": "<relevant fact>",
          "credibility": "high" | "medium" | "low"
        }
      ],
      "nuance": "<optional caveat or context>"
    }
  ],
  "argumentStructure": {
    "type": "deductive" | "inductive" | "analogical" | "abductive" | "mixed",
    "premises": ["<premise 1>", "<premise 2>", ...],
    "conclusion": "<main conclusion>",
    "impliedAssumptions": ["<hidden assumption 1>", ...],
    "validity": "valid" | "invalid" | "uncertain",
    "validityReason": "<explanation of validity assessment>"
  },
  "soundness": {
    "score": <0-10>,
    "strengths": ["<strength 1>", ...],
    "weaknesses": ["<weakness 1>", ...],
    "potentialRebuttals": ["<rebuttal 1>", ...]
  },
  "rhetoricalTechniques": [
    {
      "technique": "<technique name>",
      "quote": "<quote from comment>",
      "effect": "<what effect this has>",
      "effectiveness": "high" | "medium" | "low"
    }
  ],
  "logosScore": <0-100>,
  "ethosScore": <0-100>,
  "pathosScore": <0-100>,
  "overallQuality": <0-10>,
  "summary": "<2-3 sentence summary of the argument quality>"
}

Be objective and thorough. Use your extended thinking to reason carefully about each element.
Return ONLY valid JSON, no markdown wrapping.`
    }]
  })

  // Extract the text response (after thinking)
  let textContent = ''
  for (const block of response.content) {
    if (block.type === 'text') {
      textContent = block.text
      break
    }
  }

  // Clean JSON response
  let jsonText = textContent.trim()
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
    claims: result.claims || [],
    argumentStructure: result.argumentStructure || {
      type: 'mixed',
      premises: [],
      conclusion: '',
      impliedAssumptions: [],
      validity: 'uncertain',
      validityReason: 'Unable to determine'
    },
    soundness: result.soundness || {
      score: 5,
      strengths: [],
      weaknesses: [],
      potentialRebuttals: []
    },
    rhetoricalTechniques: result.rhetoricalTechniques || [],
    logosScore: result.logosScore || 50,
    ethosScore: result.ethosScore || 50,
    pathosScore: result.pathosScore || 50,
    overallQuality: result.overallQuality || 5,
    summary: result.summary || 'Analysis complete',
    analyzedAt: new Date().toISOString()
  }
}

/**
 * GET /api/analyze-comment?commentId=xxx
 *
 * Get persisted analysis for a comment if it exists
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const commentId = searchParams.get('commentId')

  if (!commentId) {
    return NextResponse.json(
      { success: false, error: 'commentId is required' },
      { status: 400 }
    )
  }

  // TODO: Check cache/database for existing analysis
  // For now, return not found
  return NextResponse.json({
    success: false,
    error: 'Analysis not found. Trigger new analysis with POST.',
    cached: false
  }, { status: 404 })
}

/**
 * ContextAuditAgent
 * Detects omissions, framing techniques, and narrative manipulation using GLM-4.7
 *
 * Focuses on what's NOT said:
- Counter-evidence omitted
- Alternative perspectives ignored
- Critical context stripped away
- Historical context erased
- Important qualifications removed
- Numerical context absent (baseline comparisons)
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type { ExtractedArticle, ContextOmission, FramingTechnique } from "@/types"

interface ContextAuditInput {
  article: ExtractedArticle
}

/**
 * Audit article for context manipulation and framing
 */
export async function auditContext(input: ContextAuditInput): Promise<{
  omissions: ContextOmission[]
  framing: FramingTechnique[]
  narrativeStructure: string
  overallScore: number // 0-100 (higher = more manipulation)
}> {
  const { article } = input

  const systemPrompt = `You are an expert at detecting context manipulation and narrative framing.

Your task:
1. Identify omissions:
   - What counter-evidence was left out?
   - Which alternative perspectives are missing?
   - What critical context is stripped away?
   - Are there important historical facts ignored?
   - Are qualifications downplayed or removed?
   - Is numerical context absent (no baselines)?

2. Detect framing techniques:
   - False balance (giving equal weight to unequal positions)
   - Narrative priming (setting up a specific story)
   - Selection bias (choosing only supporting examples)
   - Context stripping (removing crucial details)
   - Label manipulation (loaded language, terms)

3. Analyze narrative structure:
   - How does the article guide the reader?
   - What story is it trying to tell?
   - Where does it start and end? (framing by endpoints)
   - What's emphasized vs downplayed?

For each issue:
- Quote the relevant section
- Explain what's missing or distorted
- Assess severity: low (minor), medium (moderate), high (severe)
- Estimate impact on reader understanding

IMPORTANT: Return ONLY this exact JSON structure:
{
  "omissions": [
    {
      "type": "counter_evidence",
      "description": "description",
      "quote": "relevant quote",
      "whatWasMissing": "what was omitted",
      "severity": "medium",
      "impact": "impact on reader"
    }
  ],
  "framing": [
    {
      "type": "selection_bias",
      "description": "description",
      "quote": "relevant quote",
      "explanation": "how it frames the narrative",
      "severity": "medium"
    }
  ],
  "narrativeStructure": "Summary of how the article guides the reader"
}

If no issues found, return: {"omissions": [], "framing": [], "narrativeStructure": "No manipulation detected"}

Return ONLY valid JSON. No markdown code blocks, no explanations.`

  const userPrompt = `Audit this article for context manipulation and framing:\n\n${JSON.stringify(article, null, 2)}`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.5,
  })

  if (!result.success) {
    throw new Error(`Context audit failed: ${result.error}`)
  }

  const data = extractJSON(result.text)

  // Handle missing or invalid response
  let rawOmissions: any[] = []
  let rawFraming: any[] = []
  let narrativeStructure = 'Not analyzed'

  if (data) {
    rawOmissions = Array.isArray(data.omissions) ? data.omissions : []
    rawFraming = Array.isArray(data.framing) ? data.framing : []
    narrativeStructure = data.narrativeStructure || data.narrative_structure || 'Not analyzed'
  } else {
    console.warn('Context audit returned no valid JSON, assuming clean article')
  }

  const omissions = validateOmissions(rawOmissions)
  const framing = validateFraming(rawFraming)
  const overallScore = calculateContextScore(omissions, framing)

  return { omissions, framing, narrativeStructure, overallScore }
}

/**
 * Validate and structure omissions
 */
function validateOmissions(omissions: any[]): ContextOmission[] {
  return omissions.map((omission) => ({
    id: crypto.randomUUID(),
    type: omission.type || 'critical_context',
    description: omission.description || '',
    quote: omission.quote || '',
    whatWasMissing: omission.whatWasMissing || '',
    severity: omission.severity || 'medium',
    impact: omission.impact || '',
  }))
}

/**
 * Validate and structure framing techniques
 */
function validateFraming(framing: any[]): FramingTechnique[] {
  return framing.map((technique) => ({
    id: crypto.randomUUID(),
    type: technique.type || 'unknown',
    description: technique.description || '',
    quote: technique.quote || '',
    explanation: technique.explanation || '',
    severity: technique.severity || 'medium',
  }))
}

/**
 * Calculate overall context manipulation score
 */
function calculateContextScore(omissions: ContextOmission[], framing: FramingTechnique[]): number {
  let score = 0

  // Score omissions (more severe = higher score)
  for (const omission of omissions) {
    const multiplier = omission.severity === 'high' ? 10 : omission.severity === 'medium' ? 5 : 2
    score += multiplier
  }

  // Score framing (more severe = higher score)
  for (const technique of framing) {
    const multiplier = technique.severity === 'high' ? 8 : technique.severity === 'medium' ? 4 : 2
    score += multiplier
  }

  return Math.min(100, score)
}

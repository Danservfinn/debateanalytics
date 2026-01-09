/**
 * FallacyAgent
 * Detects logical fallacies and argumentation flaws using GLM-4.7
 *
 * Reuses fallacy types from debate-analytics:
 * - Formal fallacies: Invalid logical structure
 * - Informal fallacies: Relevance, ambiguity, presumption flaws
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type { ExtractedArticle, FallacyInstance } from "@/types"

interface FallacyDetectionInput {
  article: ExtractedArticle
}

/**
 * Detect all logical fallacies in the article
 */
export async function detectFallacies(input: FallacyDetectionInput): Promise<FallacyInstance[]> {
  const { article } = input

  const systemPrompt = `You are an expert in logic and critical thinking, trained to identify logical fallacies.

Common fallacies to detect:
- Ad hominem: Attacking the person instead of the argument
- Straw man: Misrepresenting an opponent's argument
- False dichotomy: Presenting only two options when more exist
- Slippery slope: Unjustified claim that A will lead to Z
- Circular reasoning: Conclusion assumes premise
- Appeal to authority: Relying on authority instead of evidence
- Hasty generalization: Drawing broad conclusions from limited data
- Cherry picking: Selecting only data that supports your conclusion
- Red herring: Introducing irrelevant distractions
- Tu quoque: "You too" deflection
- Appeal to emotion: Manipulating emotions instead of using logic
- False cause: Assuming correlation implies causation
- Moving the goalposts: Changing criteria when challenged

For each fallacy found:
- type: general category (e.g., "informal", "formal")
- name: specific fallacy name (e.g., "ad_hominem", "straw_man")
- quote: exact text from article
- context: surrounding context
- severity: "low", "medium", or "high"
- explanation: why it's fallacious

IMPORTANT: Return ONLY this exact JSON structure:
{
  "fallacies": [
    {
      "type": "informal",
      "name": "ad_hominem",
      "quote": "exact quote",
      "context": "context",
      "severity": "medium",
      "explanation": "why it's fallacious"
    }
  ]
}

If no fallacies found, return: {"fallacies": []}

Return ONLY valid JSON. No markdown code blocks, no explanations.`

  const userPrompt = `Analyze this article for logical fallacies:\n\n${JSON.stringify(article, null, 2)}`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.5,
  })

  if (!result.success) {
    throw new Error(`Fallacy detection failed: ${result.error}`)
  }

  const data = extractJSON(result.text)

  // Handle various response formats
  let rawFallacies: any[] = []

  if (data) {
    if (Array.isArray(data.fallacies)) {
      rawFallacies = data.fallacies
    } else if (Array.isArray(data)) {
      rawFallacies = data
    } else if (data.results && Array.isArray(data.results)) {
      rawFallacies = data.results
    } else if (data.logical_fallacies && Array.isArray(data.logical_fallacies)) {
      rawFallacies = data.logical_fallacies
    }
  }

  // If no valid data, return empty array (article may have no fallacies)
  if (!data) {
    console.warn('Fallacy detection returned no valid JSON, assuming clean article')
    rawFallacies = []
  }

  return validateFallacies(rawFallacies)
}

/**
 * Validate and structure fallacy instances
 */
function validateFallacies(fallacies: any[]): FallacyInstance[] {
  return fallacies.map((fallacy) => ({
    id: crypto.randomUUID(),
    type: fallacy.type || 'logical_fallacy',
    name: fallacy.name || 'Unnamed Fallacy',
    quote: fallacy.quote || '',
    context: fallacy.context || '',
    severity: fallacy.severity || 'medium',
    explanation: fallacy.explanation || '',
    deduction: calculateFallacyDeduction(fallacy.severity),
  }))
}

/**
 * Calculate point deduction based on fallacy severity
 */
function calculateFallacyDeduction(severity: string): number {
  switch (severity) {
    case 'low': return -1
    case 'medium': return -2
    case 'high': return -4
    default: return -2
  }
}

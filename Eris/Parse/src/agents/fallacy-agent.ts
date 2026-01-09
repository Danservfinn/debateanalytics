/**
 * FallacyAgent
 * Detects logical fallacies and argumentation flaws using GLM-4.7
 *
 * Reuses fallacy types from debate-analytics:
 * - Formal fallacies: Invalid logical structure
 * - Informal fallacies: Relevance, ambiguity, presumption flaws
 */

import { callGLM, callGLMWithRetry, extractJSON } from "@/lib/zai"
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

  // Use retry logic to handle transient API failures (empty responses)
  let result = await callGLMWithRetry({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.3, // Lower temperature for more consistent JSON output
  }, 2) // Retry up to 2 times on failure

  // Handle empty response - retry once more with different prompt structure
  if (result.success && (!result.text || result.text.trim().length === 0)) {
    console.warn('[FallacyAgent] Empty response received, retrying with simplified prompt...')

    // Get article body text - handle both string and object content structures
    const articleBody = typeof article.content === 'string'
      ? article.content
      : (article.content?.body || article.content?.headline || JSON.stringify(article.content))

    const simplifiedPrompt = `Identify logical fallacies in this article. List each fallacy with type, quote, and explanation.

Article title: ${article.title}
Article content:
${articleBody?.substring(0, 8000) || 'No content available'}

Return JSON: {"fallacies": [{"type": "...", "name": "...", "quote": "...", "severity": "low|medium|high", "explanation": "..."}]}`

    result = await callGLM({
      prompt: simplifiedPrompt,
      systemPrompt: 'You detect logical fallacies. Return only valid JSON.',
      model: 'glm-4.7',
      maxTokens: 3000,
      temperature: 0.2,
    })
  }

  if (!result.success) {
    throw new Error(`Fallacy detection failed: ${result.error}`)
  }

  // Debug: Log raw response for troubleshooting
  const DEBUG = process.env.DEBUG_AGENTS === 'true'
  if (DEBUG) {
    console.log('[FallacyAgent] Raw response length:', result.text.length)
    console.log('[FallacyAgent] Raw response preview:', result.text.substring(0, 500))
  }

  // Use debug mode in extractJSON to see parsing attempts
  const data = extractJSON(result.text, DEBUG)

  // Handle various response formats
  let rawFallacies: any[] = []

  if (data) {
    // Check multiple possible keys for the fallacies array
    const fallacyKeys = ['fallacies', 'logical_fallacies', 'results', 'items', 'findings', 'errors']

    for (const key of fallacyKeys) {
      if (Array.isArray(data[key])) {
        rawFallacies = data[key]
        if (DEBUG) console.log(`[FallacyAgent] Found fallacies under key: ${key}`)
        break
      }
    }

    // If data itself is an array (direct array response)
    if (rawFallacies.length === 0 && Array.isArray(data)) {
      rawFallacies = data
      if (DEBUG) console.log('[FallacyAgent] Found direct array response')
    }

    // If data has a nested structure like {analysis: {fallacies: [...]}}
    if (rawFallacies.length === 0 && !Array.isArray(data)) {
      const objData = data as Record<string, any>
      for (const key of Object.keys(objData)) {
        if (typeof objData[key] === 'object' && objData[key] !== null) {
          for (const innerKey of fallacyKeys) {
            if (Array.isArray(objData[key][innerKey])) {
              rawFallacies = objData[key][innerKey]
              if (DEBUG) console.log(`[FallacyAgent] Found nested fallacies under: ${key}.${innerKey}`)
              break
            }
          }
          if (rawFallacies.length > 0) break
        }
      }
    }
  }

  // If still no valid data, log detailed warning and return empty result
  if (!data) {
    console.warn('[FallacyAgent] JSON parsing failed - raw response:')
    console.warn(result.text.substring(0, 1000))
    rawFallacies = []
  } else if (rawFallacies.length === 0 && Object.keys(data).length > 0) {
    // Data parsed but no fallacies found - might be a "clean article" response
    if (DEBUG) console.log('[FallacyAgent] Parsed data but no fallacies array found:', JSON.stringify(data).substring(0, 500))
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

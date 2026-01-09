/**
 * DeceptionDetectionAgent
 * Detects emotional manipulation, framing bias, omissions, and propaganda using GLM-4.7
 *
 * Categories:
 * - Emotional: fear appeals, pity, anger manipulation
 * - Framing: false balance, context stripping, selection bias
 * - Omission: counter-evidence, alternative perspectives, critical context
 * - Source: anonymous experts, circular sourcing, hidden funding
 * - Propaganda: talking points, us-vs-them, slogans without substance
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type { ExtractedArticle, DeceptionInstance, DeceptionCategory, DeceptionType } from "@/types"

interface DeceptionDetectionInput {
  article: ExtractedArticle
}

/**
 * Detect all manipulation and propaganda techniques
 */
export async function detectDeception(input: DeceptionDetectionInput): Promise<{
  instances: DeceptionInstance[]
  overallRisk: 'low' | 'medium' | 'high'
  score: number
}> {
  const { article } = input

  const systemPrompt = `You are an expert at detecting media manipulation, propaganda, and deception techniques.

Your task:
1. Identify emotional manipulation (fear, pity, anger appeals)
2. Detect framing bias (false balance, context stripping, selection bias)
3. Find omissions (counter-evidence, alternative views, critical context)
4. Spot source manipulation (anonymous experts, circular sourcing, hidden funding)
5. Flag propaganda patterns (talking points, us-vs-them, slogans over substance)

For each instance found:
- category: "emotional", "framing", "omission", "source", or "propaganda"
- type: specific technique (e.g., "fear_appeal", "false_balance", "anonymous_source")
- quote: exact text from article
- context: surrounding context
- severity: "low", "medium", or "high"
- explanation: how it manipulates the reader

IMPORTANT: Return ONLY this exact JSON structure:
{
  "instances": [
    {
      "category": "emotional",
      "type": "fear_appeal",
      "quote": "exact quote",
      "context": "context",
      "severity": "medium",
      "explanation": "how it manipulates"
    }
  ]
}

If no manipulation found, return: {"instances": []}

Return ONLY valid JSON. No markdown code blocks, no explanations.`

  const userPrompt = `Analyze this article for manipulation and propaganda:\n\n${JSON.stringify(article, null, 2)}`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.3, // Lower temperature for more consistent JSON output
  })

  if (!result.success) {
    throw new Error(`Deception detection failed: ${result.error}`)
  }

  // Debug: Log raw response for troubleshooting
  const DEBUG = process.env.DEBUG_AGENTS === 'true'
  if (DEBUG) {
    console.log('[DeceptionAgent] Raw response length:', result.text.length)
    console.log('[DeceptionAgent] Raw response preview:', result.text.substring(0, 500))
  }

  // Use debug mode in extractJSON to see parsing attempts
  const data = extractJSON(result.text, DEBUG)

  // Handle various response formats
  let rawInstances: any[] = []

  if (data) {
    // Check multiple possible keys for the instances array
    const instanceKeys = ['instances', 'deception_instances', 'results', 'deceptions', 'items', 'findings']

    for (const key of instanceKeys) {
      if (Array.isArray(data[key])) {
        rawInstances = data[key]
        if (DEBUG) console.log(`[DeceptionAgent] Found instances under key: ${key}`)
        break
      }
    }

    // If data itself is an array (direct array response)
    if (rawInstances.length === 0 && Array.isArray(data)) {
      rawInstances = data
      if (DEBUG) console.log('[DeceptionAgent] Found direct array response')
    }

    // If data has a nested structure like {analysis: {instances: [...]}}
    if (rawInstances.length === 0 && !Array.isArray(data)) {
      const objData = data as Record<string, any>
      for (const key of Object.keys(objData)) {
        if (typeof objData[key] === 'object' && objData[key] !== null) {
          for (const innerKey of instanceKeys) {
            if (Array.isArray(objData[key][innerKey])) {
              rawInstances = objData[key][innerKey]
              if (DEBUG) console.log(`[DeceptionAgent] Found nested instances under: ${key}.${innerKey}`)
              break
            }
          }
          if (rawInstances.length > 0) break
        }
      }
    }
  }

  // If still no valid data, log detailed warning and return empty result
  if (!data) {
    console.warn('[DeceptionAgent] JSON parsing failed - raw response:')
    console.warn(result.text.substring(0, 1000))
    rawInstances = []
  } else if (rawInstances.length === 0 && Object.keys(data).length > 0) {
    // Data parsed but no instances found - might be a "clean article" response
    if (DEBUG) console.log('[DeceptionAgent] Parsed data but no instances array found:', JSON.stringify(data).substring(0, 500))
  }

  const instances = validateDeceptionInstances(rawInstances)
  const overallRisk = calculateOverallRisk(instances)
  const score = calculateManipulationScore(instances)

  return { instances, overallRisk, score }
}

/**
 * Validate and structure deception instances
 */
function validateDeceptionInstances(instances: any[]): DeceptionInstance[] {
  return instances.map((instance) => ({
    id: crypto.randomUUID(),
    category: instance.category as DeceptionCategory,
    type: instance.type as DeceptionType,
    quote: instance.quote || '',
    context: instance.context || '',
    severity: instance.severity || 'medium',
    explanation: instance.explanation || '',
    deduction: calculateDeduction(instance.severity),
  }))
}

/**
 * Calculate point deduction based on severity
 */
function calculateDeduction(severity: string): number {
  switch (severity) {
    case 'low': return -1
    case 'medium': return -3
    case 'high': return -5
    default: return -2
  }
}

/**
 * Calculate overall manipulation risk
 */
function calculateOverallRisk(instances: DeceptionInstance[]): 'low' | 'medium' | 'high' {
  const totalDeduction = instances.reduce((sum, i) => sum + Math.abs(i.deduction), 0)

  if (totalDeduction <= 3) return 'low'
  if (totalDeduction <= 10) return 'medium'
  return 'high'
}

/**
 * Calculate manipulation score (0-100, higher = more manipulation)
 */
function calculateManipulationScore(instances: DeceptionInstance[]): number {
  const totalDeduction = instances.reduce((sum, i) => sum + Math.abs(i.deduction), 0)
  return Math.min(100, Math.max(0, totalDeduction * 3))
}

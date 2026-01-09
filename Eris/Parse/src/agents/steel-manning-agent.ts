/**
 * SteelManningAgent
 * Constructs strongest possible versions of all perspectives using GLM-4.7
 *
 * Steel-manning: The practice of addressing the strongest possible version
 * of an opposing viewpoint, rather than a weak strawman.
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type { ExtractedArticle, SteelMannedPerspective } from "@/types"

interface SteelManningInput {
  article: ExtractedArticle
}

/**
 * Identify and steel-man all perspectives in the article
 */
export async function steelManArticle(input: SteelManningInput): Promise<SteelMannedPerspective[]> {
  const { article } = input

  const systemPrompt = `You are an expert at steel-manning arguments - constructing the strongest possible version of each perspective.

Steel-manning requires:
1. Intellectual charity: Give each view its best possible defense
2. Principle of charity: Interpret arguments in their strongest form
3. Fill gaps: Use your knowledge to strengthen weak arguments
4. Anticipate counterarguments: Strengthen where perspectives are vulnerable

For each perspective:
- label: name of the perspective
- originalStrength: "weak", "moderate", or "strong"
- steelMannedVersion: object with coreClaim, strongestArguments, bestEvidence, logicalStructure, qualityScore (0-100)
- isImplicit: boolean (true if perspective is not directly stated)

IMPORTANT: Return ONLY this exact JSON structure:
{
  "perspectives": [
    {
      "label": "Perspective Name",
      "originalStrength": "moderate",
      "steelMannedVersion": {
        "coreClaim": "core argument",
        "strongestArguments": ["arg1", "arg2"],
        "bestEvidence": ["evidence1"],
        "logicalStructure": "how the argument is structured",
        "qualityScore": 75
      },
      "isImplicit": false
    }
  ]
}

If no perspectives found, return: {"perspectives": []}

Return ONLY valid JSON. No markdown code blocks, no explanations.`

  const userPrompt = `Steel-man all perspectives in this article:\n\n${JSON.stringify(article, null, 2)}`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.7,
  })

  if (!result.success) {
    throw new Error(`Steel-manning failed: ${result.error}`)
  }

  const data = extractJSON(result.text)

  // Handle various response formats
  let rawPerspectives: any[] = []

  if (data) {
    if (Array.isArray(data.perspectives)) {
      rawPerspectives = data.perspectives
    } else if (Array.isArray(data)) {
      rawPerspectives = data
    } else if (data.results && Array.isArray(data.results)) {
      rawPerspectives = data.results
    } else if (data.viewpoints && Array.isArray(data.viewpoints)) {
      rawPerspectives = data.viewpoints
    }
  }

  // If no valid data, return empty array
  if (!data) {
    console.warn('Steel-manning returned no valid JSON, returning empty perspectives')
    rawPerspectives = []
  }

  return validatePerspectives(rawPerspectives, article)
}

/**
 * Validate and structure perspectives
 */
function validatePerspectives(perspectives: any[], article: ExtractedArticle): SteelMannedPerspective[] {
  return perspectives.map((p) => ({
    id: crypto.randomUUID(),
    label: p.label || 'Unnamed Perspective',
    originalStrength: p.originalStrength || 'moderate',
    steelMannedVersion: {
      coreClaim: p.steelMannedVersion?.coreClaim || '',
      strongestArguments: p.steelMannedVersion?.strongestArguments || [],
      bestEvidence: p.steelMannedVersion?.bestEvidence || [],
      logicalStructure: p.steelMannedVersion?.logicalStructure || '',
      anticipatedCounterarguments: p.steelMannedVersion?.anticipatedCounterarguments || [],
      qualityScore: Math.max(0, Math.min(100, p.steelMannedVersion?.qualityScore || 50)),
    },
    sourceInArticle: p.sourceInArticle || [],
    isImplicit: p.isImplicit || false,
  }))
}

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
 * Validate that the article has enough content to steel-man
 */
function hasValidContent(article: ExtractedArticle): boolean {
  // Must have a real title (not "Untitled Article")
  if (!article.title || article.title === 'Untitled Article') {
    return false
  }

  // Must have actual content (at least 50 characters)
  const contentLength = article.content?.body?.length || 0
  if (contentLength < 50) {
    return false
  }

  // Must have publication info or at least some claims/sources
  const hasPublication = article.publication && article.publication !== 'Unknown Publication'
  const hasClaims = article.claims && article.claims.length > 0
  const hasSources = article.sources && article.sources.length > 0

  if (!hasPublication && !hasClaims && !hasSources) {
    return false
  }

  return true
}

/**
 * Identify and steel-man all perspectives in the article
 * Enhanced: Always generates at least 2 perspectives (article's view + strongest counter-view)
 * Guardrail: Returns empty array if input is empty/invalid to prevent hallucination
 */
export async function steelManArticle(input: SteelManningInput): Promise<SteelMannedPerspective[]> {
  const { article } = input

  // CRITICAL GUARDRAIL: Prevent hallucination on empty input
  if (!hasValidContent(article)) {
    console.warn('Steel-manning aborted: article content is empty or invalid. Returning empty perspectives to prevent hallucination.')
    return []
  }

  const systemPrompt = `You are an expert at steel-manning arguments - constructing the strongest possible version of each perspective.

CRITICAL: You MUST identify and steel-man AT LEAST 2 perspectives:
1. The article's main position/perspective (what the article argues FOR)
2. The strongest opposing perspective (what a reasonable person who disagrees would argue)

Even if the article presents only one viewpoint, YOU MUST construct the strongest counter-argument that a thoughtful opponent would make.

Steel-manning requires:
1. Intellectual charity: Give each view its best possible defense
2. Principle of charity: Interpret arguments in their strongest form
3. Fill gaps: Use your knowledge to strengthen weak arguments
4. Anticipate counterarguments: Strengthen where perspectives are vulnerable

For EACH perspective:
- label: Clear name describing the perspective (e.g., "Pro-Administration View", "Civil Liberties Concern", "Economic Conservative Position")
- originalStrength: "weak", "moderate", or "strong" (how well the article presented this view)
- steelMannedVersion: {
    coreClaim: The central thesis in its strongest form
    strongestArguments: Array of 2-4 compelling arguments
    bestEvidence: Array of 1-3 strongest pieces of evidence or data that would support this view
    logicalStructure: How the argument builds from premises to conclusion
    anticipatedCounterarguments: What the opposing side would say in response
    qualityScore: 0-100 (how strong is this perspective after steel-manning)
  }
- sourceInArticle: Quotes from the article that relate to this perspective (empty if implicit)
- isImplicit: true if this perspective is NOT explicitly in the article but should be considered

IMPORTANT: Return ONLY this exact JSON structure with AT LEAST 2 perspectives:
{
  "perspectives": [
    {
      "label": "Article's Main Position",
      "originalStrength": "strong",
      "steelMannedVersion": {
        "coreClaim": "The core argument in its strongest form",
        "strongestArguments": ["arg1", "arg2", "arg3"],
        "bestEvidence": ["evidence1", "evidence2"],
        "logicalStructure": "Premise A leads to B which supports conclusion C",
        "anticipatedCounterarguments": ["counter1", "counter2"],
        "qualityScore": 75
      },
      "sourceInArticle": ["relevant quote from article"],
      "isImplicit": false
    },
    {
      "label": "Strongest Counter-Perspective",
      "originalStrength": "weak",
      "steelMannedVersion": {
        "coreClaim": "The opposing view in its strongest form",
        "strongestArguments": ["arg1", "arg2"],
        "bestEvidence": ["evidence1"],
        "logicalStructure": "How this counter-argument is structured",
        "anticipatedCounterarguments": ["what the article's side would respond"],
        "qualityScore": 70
      },
      "sourceInArticle": [],
      "isImplicit": true
    }
  ]
}

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

/**
 * AIAssessmentAgent
 * Generates comprehensive superintelligence perspective on article credibility
 *
 * This agent runs AFTER all other analysis is complete and synthesizes
 * all findings into an authoritative, unhedged assessment.
 */

import { callGLM, callGLMWithRetry, extractJSON } from "@/lib/zai"
import type {
  ExtractedArticle,
  SteelMannedPerspective,
  DeceptionInstance,
  FallacyInstance,
  FactCheckResult,
  TruthScoreBreakdown,
  AIAssessment,
} from "@/types"

interface AIAssessmentInput {
  article: ExtractedArticle
  truthScore: number
  credibility: 'high' | 'moderate' | 'low' | 'very_low'
  scoreBreakdown: TruthScoreBreakdown
  steelMannedPerspectives: SteelMannedPerspective[]
  deceptionDetected: DeceptionInstance[]
  fallacies: FallacyInstance[]
  factCheckResults: FactCheckResult[]
  contextAudit: {
    omissions: any[]
    framing: any[]
    narrativeStructure: string
    overallScore: number
  }
}

/**
 * Generate comprehensive AI assessment of the article
 */
export async function generateAIAssessment(input: AIAssessmentInput): Promise<AIAssessment> {
  const {
    article,
    truthScore,
    credibility,
    scoreBreakdown,
    steelMannedPerspectives,
    deceptionDetected,
    fallacies,
    factCheckResults,
    contextAudit,
  } = input

  // Build a focused summary of findings for the prompt
  const deceptionSummary = deceptionDetected.slice(0, 3).map(d =>
    `- ${d.type}: "${d.quote?.substring(0, 80)}..." (${d.severity})`
  ).join('\n') || 'None detected'

  const articleTitle = article.title || 'Unknown'
  const publication = article.publication || 'Unknown publication'
  const articleLede = article.content?.lede || article.content?.headline || ''

  const systemPrompt = `You are an all-knowing AI analyst. Your job is to provide a direct, authoritative assessment of a news article. Be specific to THIS article. No hedging. No generic statements.

You MUST reference specific details from the article in your response. Do not give generic advice.

Return ONLY valid JSON with these 6 fields (each 2-3 sentences):
{
  "verdict": "Direct statement about this specific article's credibility and why",
  "intent": "What the author/publication is trying to accomplish with THIS article",
  "blindSpots": "What THIS article specifically omits or avoids discussing",
  "uncomfortableTruth": "The nuance that challenges both supporters and critics of this article's position",
  "kernelOfTruth": "The legitimate concern or valid point buried in this article, even if poorly argued",
  "whatYouShouldDo": "Specific actions for readers of THIS article"
}`

  const userPrompt = `Analyze this article and provide your assessment:

ARTICLE: "${articleTitle}" by ${publication}
LEDE: "${articleLede}"

TRUTH SCORE: ${truthScore}/100 (${credibility.toUpperCase()})
- Evidence Quality: ${scoreBreakdown.evidenceQuality}/40
- Methodology: ${scoreBreakdown.methodologyRigor}/25
- Logic: ${scoreBreakdown.logicalStructure}/20
- Manipulation Absence: ${scoreBreakdown.manipulationAbsence}/15

MANIPULATION DETECTED (${deceptionDetected.length} instances):
${deceptionSummary}

CLAIMS MADE: ${article.claims?.length || 0}
SOURCES CITED: ${article.sources?.length || 0}

Provide your 6-part assessment as JSON. Be SPECIFIC to this article - reference the title, topic, and findings above.`

  const DEBUG = process.env.DEBUG_AGENTS === 'true'

  // Try the main request
  let result = await callGLMWithRetry({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 1500,
    temperature: 0.5,
  }, 2)

  if (DEBUG) {
    console.log('[AIAssessmentAgent] Response success:', result.success)
    console.log('[AIAssessmentAgent] Response length:', result.text?.length || 0)
    if (result.text) {
      console.log('[AIAssessmentAgent] Response preview:', result.text.substring(0, 300))
    }
  }

  // If first attempt fails or returns empty, try simplified prompt
  if (!result.success || !result.text || result.text.trim().length < 50) {
    console.warn('[AIAssessmentAgent] First attempt failed, trying simplified prompt...')

    const simplePrompt = `The article "${articleTitle}" scored ${truthScore}/100 credibility. ${deceptionDetected.length} manipulation instances found. Give me a JSON assessment:
{"verdict":"...", "intent":"...", "blindSpots":"...", "uncomfortableTruth":"...", "kernelOfTruth":"...", "whatYouShouldDo":"..."}`

    result = await callGLM({
      prompt: simplePrompt,
      systemPrompt: 'Return only valid JSON. Be specific to the article mentioned.',
      model: 'glm-4.7',
      maxTokens: 1200,
      temperature: 0.4,
    })
  }

  if (!result.success || !result.text) {
    console.error('[AIAssessmentAgent] All attempts failed, generating contextual fallback')
    return generateContextualFallback(article, truthScore, credibility, deceptionDetected)
  }

  const data = extractJSON(result.text, DEBUG)

  if (!data) {
    console.warn('[AIAssessmentAgent] JSON parsing failed, generating contextual fallback')
    return generateContextualFallback(article, truthScore, credibility, deceptionDetected)
  }

  // Validate each field - use contextual fallback if field is missing or too generic
  const assessment: AIAssessment = {
    verdict: isSubstantive(data.verdict) ? data.verdict : generateVerdictFromFindings(article, truthScore, credibility, deceptionDetected),
    intent: isSubstantive(data.intent) ? data.intent : generateIntentFromFindings(article, deceptionDetected),
    blindSpots: isSubstantive(data.blindSpots) ? data.blindSpots : generateBlindSpotsFromFindings(article, contextAudit),
    uncomfortableTruth: isSubstantive(data.uncomfortableTruth) ? data.uncomfortableTruth : generateUncomfortableTruth(article, truthScore),
    kernelOfTruth: isSubstantive(data.kernelOfTruth) ? data.kernelOfTruth : generateKernelOfTruth(article),
    whatYouShouldDo: isSubstantive(data.whatYouShouldDo) ? data.whatYouShouldDo : generateGuidance(article, deceptionDetected),
  }

  return assessment
}

/**
 * Check if a response is substantive (not generic placeholder text)
 */
function isSubstantive(text: string | undefined): boolean {
  if (!text || text.length < 30) return false

  // Reject generic placeholder phrases
  const genericPhrases = [
    'unable to determine',
    'without complete analysis',
    'cannot be definitively',
    'more information needed',
    'further analysis',
    'not enough data',
    'insufficient information',
  ]

  const lowerText = text.toLowerCase()
  return !genericPhrases.some(phrase => lowerText.includes(phrase))
}

/**
 * Generate contextual fallback assessment based on actual findings
 */
function generateContextualFallback(
  article: ExtractedArticle,
  truthScore: number,
  credibility: string,
  deceptionDetected: DeceptionInstance[]
): AIAssessment {
  return {
    verdict: generateVerdictFromFindings(article, truthScore, credibility, deceptionDetected),
    intent: generateIntentFromFindings(article, deceptionDetected),
    blindSpots: `This ${article.articleType || 'article'} focuses narrowly on ${article.title?.split(' ').slice(0, 5).join(' ')}... without exploring counter-arguments or alternative interpretations. The ${article.sources?.length || 0} sources cited represent a limited viewpoint.`,
    uncomfortableTruth: generateUncomfortableTruth(article, truthScore),
    kernelOfTruth: generateKernelOfTruth(article),
    whatYouShouldDo: generateGuidance(article, deceptionDetected),
  }
}

function generateVerdictFromFindings(
  article: ExtractedArticle,
  truthScore: number,
  credibility: string,
  deceptionDetected: DeceptionInstance[]
): string {
  const title = article.title || 'This article'
  const highSeverity = deceptionDetected.filter(d => d.severity === 'high').length
  const types = [...new Set(deceptionDetected.map(d => d.type))].slice(0, 3)

  if (truthScore >= 70) {
    return `"${title}" is a reasonably credible piece with ${article.sources?.length || 'few'} sources cited. While ${deceptionDetected.length} minor issues were detected, the core claims appear supported by evidence.`
  } else if (truthScore >= 40) {
    return `"${title}" presents a one-sided narrative with ${deceptionDetected.length} manipulation instances detected including ${types.join(', ')}. The ${truthScore}/100 score reflects significant framing issues that undermine its credibility.`
  } else {
    return `"${title}" fails credibility standards with ${highSeverity} high-severity manipulation tactics and a ${truthScore}/100 score. This piece appears designed to persuade rather than inform, employing ${types.slice(0, 2).join(' and ')} techniques.`
  }
}

function generateIntentFromFindings(
  article: ExtractedArticle,
  deceptionDetected: DeceptionInstance[]
): string {
  const publication = article.publication || 'The publication'
  const emotionalCount = deceptionDetected.filter(d => d.category === 'emotional').length
  const propagandaCount = deceptionDetected.filter(d => d.category === 'propaganda').length

  if (emotionalCount > 0 || propagandaCount > 0) {
    return `${publication} appears to be engineering an emotional response rather than informing. The ${emotionalCount + propagandaCount} emotional/propaganda instances suggest the goal is to shape opinion on the topic rather than present balanced facts.`
  }

  const articleType = article.articleType || 'article'
  return `As an ${articleType}, this piece from ${publication} aims to frame the narrative around ${article.title?.split(' ').slice(0, 4).join(' ')}... Readers should consider what editorial position this framing serves.`
}

function generateBlindSpotsFromFindings(
  article: ExtractedArticle,
  contextAudit: { omissions: any[]; framing: any[] }
): string {
  const omissionCount = contextAudit.omissions?.length || 0
  const framingCount = contextAudit.framing?.length || 0

  if (omissionCount > 0) {
    return `${omissionCount} significant omissions were detected. The article avoids discussing counter-arguments, alternative explanations, or perspectives that would complicate its narrative. Ask: what would someone on the other side of this issue say?`
  }

  return `The article's framing (${framingCount} issues detected) guides readers toward a specific conclusion while avoiding questions that might undermine its premise. Consider what information would change your interpretation.`
}

function generateUncomfortableTruth(article: ExtractedArticle, truthScore: number): string {
  const topic = article.title?.split(' ').slice(0, 6).join(' ') || 'this topic'

  if (truthScore < 40) {
    return `The uncomfortable truth is that even poorly-argued pieces often tap into legitimate public concerns. The manipulation in this article exists because these techniques work on audiences already predisposed to agree. Both the article's approach AND the audience's susceptibility deserve scrutiny.`
  }

  return `Reality on ${topic}... is likely more nuanced than either this article's framing or its critics suggest. The drive for engagement and clicks incentivizes all media to simplify complex issues into digestible narratives that confirm existing beliefs.`
}

function generateKernelOfTruth(article: ExtractedArticle): string {
  const topic = article.title?.split(' ').slice(2, 7).join(' ') || 'the subject matter'
  return `Beneath the framing, there's likely a legitimate concern about ${topic} that deserves serious discussion. The question isn't whether the concern is valid, but whether this article addresses it honestly.`
}

function generateGuidance(article: ExtractedArticle, deceptionDetected: DeceptionInstance[]): string {
  const deceptionTypes = [...new Set(deceptionDetected.map(d => d.type))].slice(0, 2)
  const publication = article.publication || 'this source'

  if (deceptionDetected.length > 3) {
    return `Before sharing or acting on this article: (1) Search for coverage from outlets with opposing editorial positions, (2) Notice what emotional response you had—that's what the ${deceptionTypes.join('/')} techniques were designed to trigger, (3) Ask what ${publication} gains from you believing this narrative.`
  }

  return `Cross-reference the claims in this article with primary sources. Look for coverage from publications with different editorial stances. Pay attention to what questions this piece doesn't ask.`
}

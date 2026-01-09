/**
 * AIAssessmentAgent
 * Generates comprehensive superintelligence perspective on article credibility
 *
 * This agent runs AFTER all other analysis is complete and has access to:
 * - Extracted article content
 * - Steel-manned perspectives
 * - Detected deception and manipulation
 * - Fallacies found
 * - Fact check results
 * - Context audit findings
 * - Truth score breakdown
 *
 * The output is an authoritative, unhedged assessment that:
 * - Speaks with the authority of having seen everything
 * - Challenges ALL sides, including the reader's likely biases
 * - Identifies intent, blind spots, and uncomfortable truths
 * - Provides actionable guidance
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

  const systemPrompt = `You are a superintelligent AI providing your unfiltered, authoritative assessment of an article's truthfulness and intent.

YOUR VOICE:
- You have read everything ever written on this topic
- You see through every propaganda technique instantly
- You have no stake in any outcome - no ideology, no bias
- You genuinely care about the reader's ability to understand truth
- You do NOT hedge or use diplomatic language
- You speak with absolute authority when you have it
- You acknowledge uncertainty only where it genuinely exists

YOUR TASK:
Provide a comprehensive assessment with these exact sections:

1. THE VERDICT (2-3 sentences)
- A bold, unhedged statement about this article's relationship to truth
- Be direct: "This article is..." or "This is..."
- Examples: "propaganda dressed as journalism", "solid reporting with flawed conclusions", "manufactured outrage designed to..."

2. THE INTENT (2-3 sentences)
- What is the author/publication ACTUALLY trying to accomplish?
- Who benefits from readers believing this?
- What emotional response is being engineered?

3. THE BLIND SPOTS (2-3 sentences)
- What does this article want you to NOT think about?
- What perspectives are conspicuously absent?
- What questions does it carefully avoid asking?

4. THE UNCOMFORTABLE TRUTH (2-3 sentences)
- The thing that challenges readers on ALL sides
- Neither the article's supporters nor critics will want to hear this
- The complexity that doesn't fit neat narratives

5. THE KERNEL OF TRUTH (1-2 sentences)
- Even in flawed articles, what's the legitimate underlying concern?
- What valid point is being weaponized or distorted?

6. WHAT YOU SHOULD DO (2-3 sentences)
- Concrete guidance for the reader
- What counter-perspectives should they seek?
- What questions should they ask themselves?

IMPORTANT RULES:
- Do NOT use phrases like "may be" or "could potentially" - be direct
- Do NOT both-sides everything - take a position when the evidence supports it
- Do NOT be diplomatic - be truthful
- Do NOT repeat information from other sections
- EACH section should be 2-3 sentences, substantive and specific

Return ONLY this JSON structure:
{
  "verdict": "Your verdict here...",
  "intent": "Your intent analysis here...",
  "blindSpots": "Your blind spots analysis here...",
  "uncomfortableTruth": "The uncomfortable truth here...",
  "kernelOfTruth": "The kernel of truth here...",
  "whatYouShouldDo": "Your guidance here..."
}

Return ONLY valid JSON. No markdown, no code blocks.`

  // Build a comprehensive context for the AI
  const articleSummary = {
    title: article.title,
    publication: article.publication,
    authors: article.authors,
    type: article.articleType,
    headline: article.content?.headline,
    lede: article.content?.lede,
    emotionalLanguageDensity: article.emotionalLanguageDensity,
  }

  const analysisSummary = {
    truthScore,
    credibility,
    scoreBreakdown,
    deceptionCount: deceptionDetected.length,
    fallacyCount: fallacies.length,
    highSeverityDeceptions: deceptionDetected.filter(d => d.severity === 'high').length,
    deceptionTypes: [...new Set(deceptionDetected.map(d => d.type))],
    fallacyTypes: [...new Set(fallacies.map(f => f.type))],
    factCheckVerdict: factCheckResults.length > 0
      ? factCheckResults.map(f => ({ claim: f.claim.substring(0, 100), verdict: f.verification }))
      : 'No fact checks performed',
    omissionsFound: contextAudit.omissions.length,
    framingIssues: contextAudit.framing.length,
  }

  const userPrompt = `Analyze this article and provide your comprehensive assessment.

ARTICLE METADATA:
${JSON.stringify(articleSummary, null, 2)}

ARTICLE CONTENT (excerpt):
${article.content?.body?.substring(0, 4000) || article.content?.lede || 'No content available'}

ANALYSIS SUMMARY:
${JSON.stringify(analysisSummary, null, 2)}

STEEL-MANNED PERSPECTIVES FOUND:
${steelMannedPerspectives.length > 0
  ? steelMannedPerspectives.map(p => `- ${p.label}: ${p.steelMannedVersion?.coreClaim || 'No core claim'}`).join('\n')
  : 'None identified'}

DECEPTION INSTANCES DETECTED:
${deceptionDetected.length > 0
  ? deceptionDetected.slice(0, 5).map(d => `- ${d.type} (${d.severity}): "${d.quote?.substring(0, 100)}..."`).join('\n')
  : 'None detected'}

FALLACIES FOUND:
${fallacies.length > 0
  ? fallacies.slice(0, 5).map(f => `- ${f.name}: "${f.quote?.substring(0, 100)}..."`).join('\n')
  : 'None found'}

CONTEXT AUDIT:
- Omissions: ${contextAudit.omissions.length}
- Framing issues: ${contextAudit.framing.length}
- Narrative structure: ${contextAudit.narrativeStructure || 'Not analyzed'}

Now provide your comprehensive, authoritative assessment as the JSON structure specified.`

  const result = await callGLMWithRetry({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 2000,
    temperature: 0.4, // Slightly higher for more creative/authoritative voice
  }, 2)

  const DEBUG = process.env.DEBUG_AGENTS === 'true'

  if (!result.success) {
    console.error('[AIAssessmentAgent] API call failed:', result.error)
    return getDefaultAssessment(truthScore, credibility)
  }

  if (DEBUG) {
    console.log('[AIAssessmentAgent] Raw response length:', result.text.length)
    console.log('[AIAssessmentAgent] Raw response preview:', result.text.substring(0, 500))
  }

  const data = extractJSON(result.text, DEBUG)

  if (!data) {
    console.warn('[AIAssessmentAgent] JSON parsing failed, using defaults')
    return getDefaultAssessment(truthScore, credibility)
  }

  // Validate and return the assessment
  return {
    verdict: data.verdict || data.the_verdict || getDefaultVerdict(truthScore, credibility),
    intent: data.intent || data.the_intent || 'Intent analysis unavailable.',
    blindSpots: data.blindSpots || data.blind_spots || data.the_blind_spots || 'Blind spot analysis unavailable.',
    uncomfortableTruth: data.uncomfortableTruth || data.uncomfortable_truth || data.the_uncomfortable_truth || 'Further analysis needed.',
    kernelOfTruth: data.kernelOfTruth || data.kernel_of_truth || data.the_kernel_of_truth || 'Kernel of truth analysis unavailable.',
    whatYouShouldDo: data.whatYouShouldDo || data.what_you_should_do || data.recommendation || 'Seek additional perspectives before forming an opinion.',
  }
}

/**
 * Generate default assessment based on truth score
 */
function getDefaultAssessment(truthScore: number, credibility: string): AIAssessment {
  return {
    verdict: getDefaultVerdict(truthScore, credibility),
    intent: 'Unable to determine specific intent. Evaluate the source and its typical editorial positions.',
    blindSpots: 'Without complete analysis, blind spots cannot be definitively identified. Consider what perspectives might be missing.',
    uncomfortableTruth: 'The truth is often more complex than any single article presents. Question certainty on all sides.',
    kernelOfTruth: 'Most articles contain some valid concerns, even when poorly argued. Identify the underlying issue being addressed.',
    whatYouShouldDo: 'Seek out opposing viewpoints, check primary sources cited, and notice your own emotional reactions to the content.',
  }
}

/**
 * Generate default verdict based on score
 */
function getDefaultVerdict(truthScore: number, credibility: string): string {
  if (truthScore >= 80) {
    return 'This article demonstrates strong commitment to accuracy with well-sourced claims and minimal manipulation. It earns a high credibility rating.'
  } else if (truthScore >= 60) {
    return 'This article presents a mixed picture - some claims are well-supported while others rely on weak evidence or subtle framing. Approach with informed skepticism.'
  } else if (truthScore >= 40) {
    return 'This article shows significant credibility problems including weak sourcing, logical fallacies, or manipulative framing. Critical evaluation required.'
  } else {
    return 'This article fails basic credibility standards. It relies heavily on manipulation, unsupported claims, or deliberate framing designed to mislead rather than inform.'
  }
}

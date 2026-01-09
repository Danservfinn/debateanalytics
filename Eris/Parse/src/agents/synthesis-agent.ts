/**
 * SynthesisAgent
 * Combines outputs from all analysis agents and calculates Truth Score using GLM-4.7
 *
 * Truth Score Components (0-100 total):
 * - Evidence Quality (0-40 points): Primary sources, peer-reviewed studies, data
 * - Methodology Rigor (0-25 points): Control groups, monitoring periods, study design
 * - Logical Structure (0-20 points): Valid arguments, no hidden assumptions, consistency
 * - Manipulation Absence (0-15 points): No emotional manipulation, framing, omissions
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type {
  ExtractedArticle,
  SteelMannedPerspective,
  DeceptionInstance,
  FactCheckResult,
  FallacyInstance,
  ParseAnalysis,
  TruthScoreBreakdown,
} from "@/types"

interface SynthesisInput {
  article: ExtractedArticle
  steelMannedPerspectives: SteelMannedPerspective[]
  deceptionDetected: DeceptionInstance[]
  factCheckResults: FactCheckResult[]
  fallacies: FallacyInstance[]
  contextAudit: {
    omissions: any[]
    framing: any[]
    narrativeStructure: string
    overallScore: number
  }
}

/**
 * Synthesize all agent outputs and calculate Truth Score
 */
export async function synthesizeAnalysis(input: SynthesisInput): Promise<{
  truthScore: number
  breakdown: TruthScoreBreakdown
  whatAiThinks: string
  credibility: 'high' | 'moderate' | 'low' | 'very_low'
}> {
  const { article, steelMannedPerspectives, deceptionDetected, factCheckResults, fallacies, contextAudit } = input

  const systemPrompt = `You are a synthesis agent combining multiple analyses to calculate an objective Truth Score.

TRUTH SCORE FORMULA (0-100 points total):

1. Evidence Quality (0-40 points):
   - Primary sources (original studies, raw data): +40 max
   - Secondary sources (meta-analyses, reviews): +30 max
   - Tertiary sources (news, opinion pieces): +20 max
   - No sources or only assertions: 0 points
   - Deduct for weak, cherry-picked, or misrepresented sources

2. Methodology Rigor (0-25 points):
   - Control group analysis: +8 points (adequate) to +0 (none/poor)
   - Monitoring period audit: +7 points (sufficient duration) to +0 (too short/none)
   - Study design evaluation: +5 points (RCT > cohort > case-control) to +0 (uncontrolled)
   - Sample size assessment: +3 points (adequate power) to +0 (underpowered/anecdotal)
   - Funding conflicts: +2 points (disclosed, independent) to -5 (undisclosed conflicts)
   - Apply Universal Critical Analysis Framework

3. Logical Structure (0-20 points):
   - Argument validity: +10 points (valid deductions) to +0 (invalid fallacies)
   - Hidden assumptions: +5 points (explicit, reasonable) to +0 (hidden, unreasonable)
   - Internal consistency: +5 points (consistent) to +0 (contradictory)

4. Manipulation Absence (0-15 points, inverted):
   - Start at 15, deduct for each manipulation instance:
   - Emotional manipulation: -3 per instance
   - Framing bias: -2 per instance
   - Major omission: -4 per instance
   - Source manipulation: -3 per instance
   - Propaganda pattern: -5 per instance
   - Minimum score: 0 (no negative)

CREDIBILITY RATING:
- 80-100: HIGH (well-sourced, rigorous methodology, minimal manipulation)
- 60-79: MODERATE (some sourcing and methodology, minor manipulation)
- 40-59: LOW (weak sourcing, flawed methodology, significant manipulation)
- 0-39: VERY_LOW (little to no credible evidence, heavy manipulation)

IMPORTANT: NO appeals to authority. Evaluate EVIDENCE not SOURCES.
- A study from a prestigious journal gets NO extra points if flawed
- A blog post gets full credit if it cites rigorous primary sources
- Focus on argument quality, not author credentials

IMPORTANT: Return ONLY this exact JSON structure:
{
  "evidenceQuality": 25,
  "methodologyRigor": 15,
  "logicalStructure": 12,
  "manipulationAbsence": 10,
  "credibility": "moderate",
  "whatAiThinks": "Your candid assessment of the article's credibility in 2-3 sentences."
}

Ensure all numeric fields are numbers (not strings). Return ONLY valid JSON. No markdown code blocks, no explanations.`

  const userPrompt = `Synthesize this analysis and calculate the Truth Score:

Steel-manned perspectives:
${JSON.stringify(steelMannedPerspectives, null, 2)}

Deception detected:
${JSON.stringify(deceptionDetected, null, 2)}

Fact check results:
${JSON.stringify(factCheckResults, null, 2)}

Fallacies found:
${JSON.stringify(fallacies, null, 2)}

Context audit:
${JSON.stringify(contextAudit, null, 2)}

Calculate:
1. Evidence Quality score (0-40) with justification
2. Methodology Rigor score (0-25) with justification
3. Logical Structure score (0-20) with justification
4. Manipulation Absence score (0-15) with justification
5. Total Truth Score (sum of all four)
6. Credibility rating (high/moderate/low/very_low)
7. "What AI Thinks" - your candid, neutral assessment of the article's credibility`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 3000,
    temperature: 0.5,
  })

  if (!result.success) {
    throw new Error(`Synthesis failed: ${result.error}`)
  }

  const data = extractJSON(result.text)

  // Handle missing or invalid response with sensible defaults
  if (!data) {
    console.warn('Synthesis returned no valid JSON, using default moderate scores')
  }

  // Helper to extract numeric values with fallbacks
  const getScore = (primary: any, ...alternates: any[]): number => {
    const candidates = [primary, ...alternates]
    for (const val of candidates) {
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const parsed = parseFloat(val)
        if (!isNaN(parsed)) return parsed
      }
    }
    return 0
  }

  // Validate scores with flexible key name handling
  const evidenceQuality = Math.max(0, Math.min(40, getScore(
    data?.evidenceQuality, data?.evidence_quality, data?.evidence, 20
  )))
  const methodologyRigor = Math.max(0, Math.min(25, getScore(
    data?.methodologyRigor, data?.methodology_rigor, data?.methodology, 12
  )))
  const logicalStructure = Math.max(0, Math.min(20, getScore(
    data?.logicalStructure, data?.logical_structure, data?.logic, 10
  )))
  const manipulationAbsence = Math.max(0, Math.min(15, getScore(
    data?.manipulationAbsence, data?.manipulation_absence, data?.manipulation, 8
  )))

  const truthScore = evidenceQuality + methodologyRigor + logicalStructure + manipulationAbsence

  // Get text fields with fallbacks
  const whatAiThinks = data?.whatAiThinks || data?.what_ai_thinks || data?.assessment ||
    'This article presents information that warrants careful evaluation. Readers should verify claims against primary sources.'

  // Determine credibility based on score if not provided
  let credibility: 'high' | 'moderate' | 'low' | 'very_low' = 'moderate'
  if (data?.credibility) {
    const cred = String(data.credibility).toLowerCase().replace('_', '')
    if (cred === 'high') credibility = 'high'
    else if (cred === 'moderate' || cred === 'medium') credibility = 'moderate'
    else if (cred === 'low') credibility = 'low'
    else if (cred === 'verylow' || cred === 'very_low') credibility = 'very_low'
  } else {
    // Calculate from score
    if (truthScore >= 80) credibility = 'high'
    else if (truthScore >= 60) credibility = 'moderate'
    else if (truthScore >= 40) credibility = 'low'
    else credibility = 'very_low'
  }

  return {
    truthScore,
    breakdown: {
      evidenceQuality,
      methodologyRigor,
      logicalStructure,
      manipulationAbsence,
    },
    whatAiThinks,
    credibility,
  }
}

/**
 * Create shareable analysis card data
 */
export function createShareableCard(analysis: ParseAnalysis): {
  summary: string
  scoreBadge: string
  shareUrl: string
} {
  const { truthScore, credibility, url } = analysis

  const summary = `Parse Analysis: ${truthScore}/100 (${credibility.toUpperCase()})\n\nEvidence Quality: ${analysis.scoreBreakdown.evidenceQuality}/40\nMethodology Rigor: ${analysis.scoreBreakdown.methodologyRigor}/25\nLogical Structure: ${analysis.scoreBreakdown.logicalStructure}/20\nManipulation Absence: ${analysis.scoreBreakdown.manipulationAbsence}/15`

  const scoreBadge = credibility === 'high' ? '✅' : credibility === 'moderate' ? '⚠️' : credibility === 'low' ? '❌' : '🚫'

  // Generate share URL (implementation depends on your hosting)
  const shareUrl = `${process.env.NEXTAUTH_URL || 'https://parseapp.vercel.app'}/analyze/result/${analysis.id}`

  return { summary, scoreBadge, shareUrl }
}

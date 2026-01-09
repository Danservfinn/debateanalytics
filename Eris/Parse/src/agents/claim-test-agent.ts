/**
 * ClaimTestAgent
 * Deep verification agent for individual claims
 *
 * Takes a single claim and performs comprehensive analysis:
 * - Searches for supporting/contradicting evidence
 * - Evaluates source credibility
 * - Provides structured verdict with confidence level
 * - Returns actionable findings and recommendations
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type {
  ClaimTestRequest,
  ClaimTestResult,
  ClaimVerdict,
  EvidenceItem,
  VerificationSource,
} from "@/types"

interface ClaimTestInput {
  claimId: string
  claim: string
  context: string
  articleUrl?: string
  articleTitle?: string
}

/**
 * Test a single claim with deep verification
 */
export async function testClaim(input: ClaimTestInput): Promise<ClaimTestResult> {
  const startTime = Date.now()
  const { claimId, claim, context, articleUrl, articleTitle } = input

  const systemPrompt = `You are an expert fact-checker and research analyst. Your task is to rigorously verify a specific claim.

CLAIM TO VERIFY:
"${claim}"

ORIGINAL CONTEXT:
${context}
${articleUrl ? `\nSOURCE ARTICLE: ${articleUrl}` : ''}
${articleTitle ? `\nARTICLE TITLE: ${articleTitle}` : ''}

Your analysis must be thorough, balanced, and evidence-based. Consider:

1. EVIDENCE GATHERING
   - What evidence supports this claim?
   - What evidence contradicts this claim?
   - What contextual information is relevant?
   - Rate each piece of evidence for relevance (0-100) and credibility (high/medium/low)

2. SOURCE EVALUATION
   - What sources would be authoritative on this topic?
   - Consider: academic research, government data, expert consensus, fact-checker verdicts
   - Rate source credibility (0-10)

3. VERDICT DETERMINATION
   Choose one of these verdicts:
   - verified: Claim is fully accurate and well-supported by evidence
   - mostly_true: Claim is substantially accurate with minor inaccuracies or missing context
   - partially_true: Claim contains some truth but is incomplete or missing important context
   - misleading: Claim may be technically true but is presented in a way that leads to false conclusions
   - mostly_false: Claim contains more false elements than true
   - false: Claim is demonstrably false
   - unverifiable: Cannot be definitively verified or refuted with available evidence

4. CONFIDENCE ASSESSMENT
   Rate your confidence in the verdict (0-100) based on:
   - Quality and quantity of evidence
   - Source reliability
   - Complexity of the claim
   - Potential for nuance or interpretation

Return ONLY this exact JSON structure:
{
  "verdict": "verified|mostly_true|partially_true|misleading|mostly_false|false|unverifiable",
  "confidence": 75,
  "summary": "One-paragraph summary of findings",
  "evidence": {
    "supporting": [
      {
        "type": "study|data|expert_opinion|official_source|news_report|fact_check",
        "title": "Title of the evidence",
        "source": "Organization or publication",
        "url": "https://example.com/source (if available)",
        "relevance": 85,
        "credibility": "high|medium|low",
        "excerpt": "Key finding or quote",
        "publicationDate": "2024-01-15 (if known)",
        "methodology": "How this evidence was gathered (if applicable)"
      }
    ],
    "contradicting": [],
    "contextual": []
  },
  "sources": [
    {
      "name": "Source name",
      "type": "academic|government|news|fact_checker|expert|data_source",
      "url": "https://example.com",
      "credibilityScore": 8,
      "notes": "Why this source is relevant"
    }
  ],
  "analysis": {
    "methodology": "How you approached verifying this claim",
    "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
    "limitations": "What limitations exist in your analysis",
    "recommendation": "What readers should understand about this claim",
    "fullText": "Detailed multi-paragraph analysis explaining the verdict"
  }
}

IMPORTANT GUIDELINES:
- Be intellectually honest - don't bias toward any conclusion
- If evidence is mixed, acknowledge the complexity
- If you cannot verify, say so clearly
- Ground every claim in specific evidence
- Consider alternative interpretations
- Note any limitations in your analysis

Return ONLY valid JSON. No markdown code blocks, no explanations outside the JSON.`

  const userPrompt = `Please verify this claim and provide a comprehensive analysis:

CLAIM: "${claim}"

CONTEXT: ${context}`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.3,
  })

  if (!result.success) {
    throw new Error(`Claim verification failed: ${result.error}`)
  }

  const DEBUG = process.env.DEBUG_AGENTS === 'true'
  if (DEBUG) {
    console.log('[ClaimTestAgent] Raw response length:', result.text.length)
    console.log('[ClaimTestAgent] Raw response preview:', result.text.substring(0, 500))
  }

  const data = extractJSON(result.text, DEBUG)

  if (!data) {
    console.warn('[ClaimTestAgent] JSON parsing failed, returning unverifiable result')
    return createUnverifiableResult(claimId, claim, startTime)
  }

  // Validate and structure the result
  return validateClaimTestResult(data, claimId, claim, startTime)
}

/**
 * Create a fallback result when verification fails
 */
function createUnverifiableResult(claimId: string, claim: string, startTime: number): ClaimTestResult {
  return {
    claimId,
    claim,
    verdict: 'unverifiable',
    confidence: 0,
    summary: 'Unable to complete verification analysis. The claim could not be processed by our verification system.',
    evidence: {
      supporting: [],
      contradicting: [],
      contextual: [],
    },
    sources: [],
    analysis: {
      methodology: 'Automated verification attempted but failed to complete',
      keyFindings: ['Verification system encountered an error'],
      limitations: 'Full analysis could not be completed',
      recommendation: 'Manual fact-checking recommended for this claim',
      fullText: 'The automated verification system was unable to complete analysis of this claim. This may be due to the complexity of the claim, the lack of readily verifiable information, or a technical issue. We recommend seeking additional sources to verify this claim independently.',
    },
    testedAt: new Date().toISOString(),
    processingTime: Date.now() - startTime,
  }
}

/**
 * Validate and structure the raw LLM response
 */
function validateClaimTestResult(
  data: any,
  claimId: string,
  claim: string,
  startTime: number
): ClaimTestResult {
  // Validate verdict
  const validVerdicts: ClaimVerdict[] = [
    'verified', 'mostly_true', 'partially_true',
    'misleading', 'mostly_false', 'false', 'unverifiable'
  ]
  const verdict: ClaimVerdict = validVerdicts.includes(data.verdict)
    ? data.verdict
    : 'unverifiable'

  // Validate confidence
  const confidence = Math.min(100, Math.max(0, Number(data.confidence) || 50))

  // Validate evidence arrays
  const evidence = {
    supporting: validateEvidenceArray(data.evidence?.supporting || []),
    contradicting: validateEvidenceArray(data.evidence?.contradicting || []),
    contextual: validateEvidenceArray(data.evidence?.contextual || []),
  }

  // Validate sources
  const sources = validateSourcesArray(data.sources || [])

  // Validate analysis
  const analysis = {
    methodology: data.analysis?.methodology || 'Standard fact-checking methodology applied',
    keyFindings: Array.isArray(data.analysis?.keyFindings)
      ? data.analysis.keyFindings
      : ['Analysis completed'],
    limitations: data.analysis?.limitations || 'Standard analysis limitations apply',
    recommendation: data.analysis?.recommendation || 'Consider the evidence and draw your own conclusions',
    fullText: data.analysis?.fullText || generateFallbackAnalysis(claim, verdict, evidence),
  }

  return {
    claimId,
    claim,
    verdict,
    confidence,
    summary: data.summary || generateSummary(claim, verdict, confidence),
    evidence,
    sources,
    analysis,
    testedAt: new Date().toISOString(),
    processingTime: Date.now() - startTime,
  }
}

/**
 * Validate evidence items array
 */
function validateEvidenceArray(items: any[]): EvidenceItem[] {
  if (!Array.isArray(items)) return []

  return items.map((item, index) => ({
    id: crypto.randomUUID(),
    type: validateEvidenceType(item.type),
    title: item.title || `Evidence ${index + 1}`,
    source: item.source || 'Unknown source',
    url: item.url,
    relevance: Math.min(100, Math.max(0, Number(item.relevance) || 50)),
    credibility: validateCredibility(item.credibility),
    excerpt: item.excerpt || 'No excerpt available',
    publicationDate: item.publicationDate,
    methodology: item.methodology,
  }))
}

/**
 * Validate evidence type
 */
function validateEvidenceType(type: string): EvidenceItem['type'] {
  const validTypes: EvidenceItem['type'][] = [
    'study', 'data', 'expert_opinion', 'official_source', 'news_report', 'fact_check'
  ]
  return validTypes.includes(type as EvidenceItem['type'])
    ? (type as EvidenceItem['type'])
    : 'news_report'
}

/**
 * Validate credibility level
 */
function validateCredibility(credibility: string): 'high' | 'medium' | 'low' {
  if (credibility === 'high' || credibility === 'medium' || credibility === 'low') {
    return credibility
  }
  return 'medium'
}

/**
 * Validate sources array
 */
function validateSourcesArray(sources: any[]): VerificationSource[] {
  if (!Array.isArray(sources)) return []

  return sources.map((source) => ({
    name: source.name || 'Unknown source',
    type: validateSourceType(source.type),
    url: source.url,
    credibilityScore: Math.min(10, Math.max(0, Number(source.credibilityScore) || 5)),
    notes: source.notes,
  }))
}

/**
 * Validate source type
 */
function validateSourceType(type: string): VerificationSource['type'] {
  const validTypes: VerificationSource['type'][] = [
    'academic', 'government', 'news', 'fact_checker', 'expert', 'data_source'
  ]
  return validTypes.includes(type as VerificationSource['type'])
    ? (type as VerificationSource['type'])
    : 'news'
}

/**
 * Generate fallback summary
 */
function generateSummary(claim: string, verdict: ClaimVerdict, confidence: number): string {
  const verdictDescriptions: Record<ClaimVerdict, string> = {
    verified: 'This claim appears to be accurate and well-supported by evidence.',
    mostly_true: 'This claim is substantially accurate with minor caveats.',
    partially_true: 'This claim contains some truth but requires additional context.',
    misleading: 'While potentially containing factual elements, this claim is presented in a misleading manner.',
    mostly_false: 'This claim contains significant inaccuracies.',
    false: 'This claim appears to be inaccurate based on available evidence.',
    unverifiable: 'This claim cannot be definitively verified with available evidence.',
  }

  return `${verdictDescriptions[verdict]} Confidence level: ${confidence}%.`
}

/**
 * Generate fallback analysis text
 */
function generateFallbackAnalysis(
  claim: string,
  verdict: ClaimVerdict,
  evidence: ClaimTestResult['evidence']
): string {
  const supportCount = evidence.supporting.length
  const contradictCount = evidence.contradicting.length
  const contextCount = evidence.contextual.length

  let analysis = `Analysis of the claim: "${claim.substring(0, 100)}${claim.length > 100 ? '...' : ''}"\n\n`

  if (supportCount > 0 || contradictCount > 0) {
    analysis += `We found ${supportCount} piece(s) of supporting evidence and ${contradictCount} piece(s) of contradicting evidence. `
  }

  if (contextCount > 0) {
    analysis += `Additionally, ${contextCount} piece(s) of contextual information were identified. `
  }

  analysis += `\n\nBased on the available evidence, the claim has been rated as "${verdict}". `
  analysis += `This assessment considers the quality, quantity, and reliability of sources examined. `
  analysis += `Readers are encouraged to review the specific evidence provided and consider additional sources.`

  return analysis
}

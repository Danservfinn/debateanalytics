/**
 * CriticalFactCheckAgent
 * Performs independent research using DuckDuckGo search to verify claims
 *
 * Applies Universal Critical Analysis Framework:
 * - Control group skepticism: Was there a control group? Was it adequate?
 * - Monitoring period: Was the study long enough to detect effects?
 * - Study design: Correlation vs causation, sample size, selection bias
 * - Evidence hierarchy: RCTs > cohort studies > case reports > expert opinion
 */

import { callGLM, extractJSON } from "@/lib/zai"
import { searchWeb } from "@/lib/search"
import type { ExtractedArticle, FactCheckResult } from "@/types"

interface FactCheckInput {
  article: ExtractedArticle
}

/**
 * Perform critical fact-checking with independent research
 */
export async function factCheckArticle(input: FactCheckInput): Promise<FactCheckResult[]> {
  const { article } = input

  // Step 1: Identify claims to verify (prioritize testable claims)
  const testableClaims = article.claims.filter(
    claim => claim.verifiability === 'testable' || claim.verifiability === 'partially_testable'
  ).slice(0, 10) // Limit to 10 most important claims

  if (testableClaims.length === 0) {
    return []
  }

  // Step 2: Perform independent research for each claim
  const factChecks: FactCheckResult[] = []

  for (const claim of testableClaims) {
    try {
      const result = await verifyClaim(claim, article)
      factChecks.push(result)
    } catch (error) {
      console.error(`Failed to verify claim: ${claim.text}`, error)
      // Add failed check
      factChecks.push({
        id: crypto.randomUUID(),
        claimId: claim.id,
        claim: claim.text,
        verification: 'inconclusive',
        confidence: 0,
        sources: [],
        methodology: 'search_failed',
        methodologyScore: 0,
        evidenceHierarchy: 'tertiary',
        reasoning: `Failed to perform independent research: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  return factChecks
}

/**
 * Verify a single claim through independent research
 */
async function verifyClaim(claim: any, article: ExtractedArticle): Promise<FactCheckResult> {
  // Step 1: Search for independent sources
  const searchQueries = generateSearchQueries(claim, article)
  const searchResults = await searchWebWithVariations(searchQueries)

  // If no search results, return inconclusive rather than trying to verify with no data
  if (searchResults.length === 0) {
    console.log(`[FactCheck] No search results for claim: ${claim.text.substring(0, 50)}...`)
    return {
      id: crypto.randomUUID(),
      claimId: claim.id,
      claim: claim.text,
      verification: 'inconclusive',
      confidence: 30,
      sources: [],
      methodology: 'no_search_results',
      methodologyScore: 0,
      evidenceHierarchy: 'tertiary',
      reasoning: 'Unable to find independent sources to verify this claim. Search returned no results.',
    }
  }

  // Step 2: Use GLM-4.7 to analyze sources and assess claim
  const systemPrompt = `You are an expert fact-checker applying rigorous critical analysis.

For each claim:
1. Search for independent verification (not just the article's sources)
2. Assess evidence hierarchy:
   - Primary sources (raw data, original studies): HIGH confidence
   - Secondary sources (reviews, meta-analyses): MEDIUM-HIGH confidence
   - Tertiary sources (news reports, expert opinion): LOW-MEDIUM confidence
3. Evaluate methodology:
   - Control groups: Were they adequate? Any confounding variables?
   - Monitoring period: Long enough to detect effects?
   - Study design: Correlation ≠ causation
   - Sample size: Statistically significant?
4. Check for conflicts of interest
5. Assess consensus vs outlier findings

Return ONLY valid JSON. No markdown, no explanations.`

  const userPrompt = `Verify this claim using independent research:

Claim: ${claim.text}
Context: ${claim.context}

Search results:
${JSON.stringify(searchResults, null, 2)}

IMPORTANT: Return ONLY this exact JSON structure:
{
  "verification": "supported",
  "confidence": 75,
  "sources": [{"name": "Source Name", "url": "https://..."}],
  "methodology": "description of methodology",
  "methodologyScore": 70,
  "evidenceHierarchy": "primary",
  "reasoning": "Your reasoning for the verdict"
}

- verification: "supported", "refuted", "mixed", or "inconclusive"
- confidence: 0-100
- evidenceHierarchy: "primary", "secondary", or "tertiary"

Return ONLY valid JSON. No markdown code blocks, no explanations.`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.7',
    maxTokens: 2000,
    temperature: 0.5,
  })

  if (!result.success) {
    throw new Error(`GLM fact-check failed: ${result.error}`)
  }

  const data = extractJSON(result.text)

  if (!data) {
    throw new Error('Failed to parse GLM response as JSON')
  }

  return {
    id: crypto.randomUUID(),
    claimId: claim.id,
    claim: claim.text,
    verification: data.verification || 'inconclusive',
    confidence: Math.max(0, Math.min(100, data.confidence || 50)),
    sources: data.sources || [],
    methodology: data.methodology || 'unspecified',
    methodologyScore: data.methodologyScore || 0,
    evidenceHierarchy: data.evidenceHierarchy || 'tertiary',
    reasoning: data.reasoning || '',
  }
}

/**
 * Generate search queries for a claim
 */
function generateSearchQueries(claim: any, article: ExtractedArticle): string[] {
  const baseQueries = [
    `"${claim.text}" fact check`,
    `"${claim.text}" study`,
    `"${claim.text}" research`,
  ]

  // Add domain-specific queries
  if (article.publication) {
    baseQueries.push(`${claim.text} ${article.publication}`)
  }

  // Add statistical queries if claim contains numbers
  if (claim.text.match(/\d+%|\d+\s*(percent|million|billion|thousand)/)) {
    baseQueries.push(`${claim.text} statistics`)
  }

  return baseQueries
}

/**
 * Search with query variations to avoid filter bubbles
 */
async function searchWebWithVariations(queries: string[]): Promise<any[]> {
  const allResults = []

  for (const query of queries.slice(0, 3)) { // Limit to 3 queries
    try {
      const results = await searchWeb(query, { limit: 5 })
      allResults.push(...results)
    } catch (error) {
      console.error(`Search failed for query: ${query}`, error)
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  return allResults.filter(result => {
    if (seen.has(result.url)) return false
    seen.add(result.url)
    return true
  }).slice(0, 10) // Limit to 10 total results
}

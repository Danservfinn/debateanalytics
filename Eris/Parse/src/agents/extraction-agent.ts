/**
 * ExtractionAgent
 * Extracts structured content from article URLs using GLM-4.5
 *
 * Uses Jina Reader API to handle JavaScript-rendered pages
 */

import { callGLM, extractJSON } from "@/lib/zai"
import type { ExtractedArticle, ExtractedClaim, ArticleSource, StatisticReference } from "@/types"

interface ExtractionInput {
  url: string
  html?: string // Optional pre-fetched HTML
}

/**
 * Fetch article content using Jina Reader API (handles JavaScript rendering)
 */
async function fetchWithJinaReader(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`

  const response = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
      'User-Agent': 'Mozilla/5.0 (compatible; ParseBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Jina Reader failed: ${response.status}`)
  }

  return response.text()
}

/**
 * Fallback: Direct fetch for simple HTML pages
 */
async function fetchDirect(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

/**
 * Extract structured article data from URL
 */
export async function extractArticle(input: ExtractionInput): Promise<ExtractedArticle> {
  const { url, html } = input

  // Step 1: Fetch article content if not provided
  let articleContent = html
  let isMarkdown = false

  if (!articleContent) {
    try {
      // Try Jina Reader first (handles JavaScript-rendered pages)
      console.log('Attempting Jina Reader extraction for:', url)
      articleContent = await fetchWithJinaReader(url)
      isMarkdown = true // Jina returns clean markdown
      console.log('Jina Reader succeeded, content length:', articleContent.length)
    } catch (jinaError) {
      console.log('Jina Reader failed, falling back to direct fetch:', jinaError)
      try {
        // Fallback to direct fetch
        articleContent = await fetchDirect(url)
        isMarkdown = false
      } catch (directError) {
        throw new Error(`Failed to fetch article from URL: ${directError instanceof Error ? directError.message : 'Unknown error'}`)
      }
    }
  }

  // Step 2: Use GLM-4.5 to extract structured data
  const contentType = isMarkdown ? 'markdown/text' : 'HTML'
  const systemPrompt = `You are an expert article extraction system. Your task is to parse article content and extract structured information.

The content will be provided as ${contentType}. Extract all available information.

Extract:
1. Metadata: title (string), authors (array of strings), publication (string), publishDate (string), articleType (string)
2. Content structure: headline (string), subhead (string or null), lede (first paragraph or summary), body (main article text), sections (array)
3. All claims with: text (string), type (factual/causal/predictive/normative/opinion), verifiability (IMPORTANT: mark as "testable" if the claim can be verified with evidence, "partially_testable" if some aspects can be verified, "untestable" only for pure opinions), section, context
4. All sources with: type (study/expert/organization/document/data), name, url, credibilityIndicators
5. All statistics with: value, context, source, isBaselineProvided
6. Emotional language density (number 0-1)

For live news pages or articles with multiple updates, extract the overall story and main claims.

IMPORTANT: Return ONLY a flat JSON object with this exact structure:
{
  "title": "...",
  "authors": ["..."],
  "publication": "...",
  "publishDate": "...",
  "articleType": "...",
  "content": {
    "headline": "...",
    "subhead": "...",
    "lede": "...",
    "body": "...",
    "sections": []
  },
  "claims": [
    {
      "text": "...",
      "type": "...",
      "verifiability": "...",
      "section": "...",
      "context": "..."
    }
  ],
  "sources": [...],
  "statistics": [...],
  "emotionalLanguageDensity": 0.5
}

No markdown code blocks, no explanations, just the raw JSON.`

  const userPrompt = `Extract structured data from this article (${contentType}):\n\n${articleContent.substring(0, 100000)}`

  const result = await callGLM({
    prompt: userPrompt,
    systemPrompt,
    model: 'glm-4.5',
    maxTokens: 6000,
    temperature: 0.3, // Lower temperature for extraction
  })

  if (!result.success) {
    throw new Error(`GLM extraction failed: ${result.error}`)
  }

  // Step 3: Parse JSON response
  const extractedData = extractJSON(result.text)

  if (!extractedData) {
    throw new Error('Failed to parse GLM response as JSON')
  }

  // Step 4: Validate and structure the data
  // Handle body as array or string
  let bodyText = ''
  if (Array.isArray(extractedData.content?.body)) {
    bodyText = extractedData.content.body.join('\n\n')
  } else if (typeof extractedData.content?.body === 'string') {
    bodyText = extractedData.content.body
  }

  const article: ExtractedArticle = {
    id: crypto.randomUUID(),
    url,
    title: extractedData.title || 'Untitled Article',
    authors: extractedData.authors || [],
    publication: extractedData.publication || 'Unknown Publication',
    publishDate: extractedData.publishDate || new Date().toISOString().split('T')[0],
    articleType: extractedData.articleType || 'news',
    content: {
      headline: extractedData.content?.headline || extractedData.title || '',
      subhead: extractedData.content?.subhead || null,
      lede: extractedData.content?.lede || '',
      body: bodyText,
      sections: extractedData.content?.sections || [],
    },
    claims: validateClaims(Array.isArray(extractedData.claims) ? extractedData.claims : []),
    sources: validateSources(Array.isArray(extractedData.sources) ? extractedData.sources : []),
    statistics: validateStatistics(Array.isArray(extractedData.statistics) ? extractedData.statistics : []),
    emotionalLanguageDensity: calculateEmotionalDensity(extractedData),
  }

  return article
}

/**
 * Validate and structure claims
 * Enhanced: Infer verifiability from claim type if not specified
 */
function validateClaims(claims: any[]): ExtractedClaim[] {
  return claims.map((claim, index) => {
    const type = claim.type || 'opinion'

    // Infer verifiability from claim type if not properly specified
    let verifiability = claim.verifiability || 'untestable'
    if (verifiability === 'untestable' || !verifiability) {
      // Factual and statistical claims are usually testable
      if (type === 'factual' || type === 'statistical') {
        verifiability = 'testable'
      } else if (type === 'causal' || type === 'predictive') {
        verifiability = 'partially_testable'
      } else if (type === 'normative' || type === 'opinion') {
        verifiability = 'untestable'
      }
    }

    return {
      id: crypto.randomUUID(),
      text: claim.text || '',
      type,
      verifiability,
      section: claim.section || 'unknown',
      context: claim.context || '',
    }
  })
}

/**
 * Validate and structure sources
 */
function validateSources(sources: any[]): ArticleSource[] {
  return sources.map((source) => ({
    id: crypto.randomUUID(),
    type: source.type || 'expert',
    name: source.name || 'Unnamed Source',
    url: source.url || null,
    credibilityIndicators: {
      isPeerReviewed: source.credibilityIndicators?.isPeerReviewed || false,
      hasFundingDisclosed: source.credibilityIndicators?.hasFundingDisclosed || false,
      isPreprint: source.credibilityIndicators?.isPreprint || false,
      publicationDate: source.credibilityIndicators?.publicationDate || null,
    },
  }))
}

/**
 * Validate and structure statistics
 */
function validateStatistics(stats: any[]): StatisticReference[] {
  return stats.map((stat) => ({
    id: crypto.randomUUID(),
    value: stat.value || '',
    context: stat.context || '',
    source: stat.source || null,
    isBaselineProvided: stat.isBaselineProvided || false,
  }))
}

/**
 * Calculate emotional language density
 * Uses AI-provided score or falls back to simple heuristic
 */
function calculateEmotionalDensity(extractedData: any): number {
  // If AI provided a score, use it
  if (typeof extractedData.emotionalLanguageDensity === 'number') {
    return Math.max(0, Math.min(1, extractedData.emotionalLanguageDensity))
  }

  // Fallback: count emotional words in body
  const emotionalWords = [
    'shocking', 'outrageous', 'devastating', 'terrifying', 'horrifying',
    'incredible', 'unbelievable', 'amazing', 'disgusting', 'horrific',
    'alarming', 'disturbing', 'chilling', 'stunning', 'mind-boggling'
  ]

  const body = (extractedData.content?.body || '').toLowerCase()
  const words = body.split(/\s+/)
  const emotionalCount = words.filter((word: string) => emotionalWords.some((em: string) => word.includes(em))).length

  return Math.min(1, emotionalCount / Math.max(1, words.length * 0.05))
}

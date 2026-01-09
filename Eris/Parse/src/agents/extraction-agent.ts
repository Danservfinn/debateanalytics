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
 * Pre-extract metadata from HTML using regex (fallback when GLM fails)
 */
function preExtractFromHTML(html: string, url: string): {
  title: string | null
  authors: string[]
  publication: string | null
  publishDate: string | null
  description: string | null
  cleanedContent: string
} {
  // Decode HTML entities
  const decodeEntities = (str: string) => str
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))

  // Extract title from multiple sources
  let title: string | null = null
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
  if (ogTitleMatch) title = decodeEntities(ogTitleMatch[1])

  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      title = decodeEntities(titleMatch[1])
      // Remove site name suffix (e.g., "Article Title | Fox News")
      title = title.replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '').trim()
    }
  }

  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) title = decodeEntities(h1Match[1])
  }

  // Extract authors
  const authors: string[] = []
  const authorMeta = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i)
  if (authorMeta) authors.push(decodeEntities(authorMeta[1]))

  // Try article:author
  const articleAuthor = html.match(/<meta[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i)
  if (articleAuthor && !authors.includes(decodeEntities(articleAuthor[1]))) {
    authors.push(decodeEntities(articleAuthor[1]))
  }

  // Extract publication from og:site_name
  let publication: string | null = null
  const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
  if (siteNameMatch) publication = decodeEntities(siteNameMatch[1])

  // Fallback: extract from URL
  if (!publication) {
    try {
      const urlObj = new URL(url)
      publication = urlObj.hostname.replace(/^www\./, '').split('.')[0]
      publication = publication.charAt(0).toUpperCase() + publication.slice(1)
    } catch { /* ignore */ }
  }

  // Extract publish date
  let publishDate: string | null = null
  const dateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<time[^>]*datetime=["']([^"']+)["']/i)
  if (dateMatch) publishDate = dateMatch[1]

  // Extract description
  let description: string | null = null
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
  if (descMatch) description = decodeEntities(descMatch[1])

  // Clean HTML for GLM: remove scripts, styles, ads, navigation
  let cleanedContent = html
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove nav, header, footer, aside
    .replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Remove common ad/tracking elements
    .replace(/<div[^>]*(ad-|advertisement|sponsored|tracking|social-share)[^>]*>[\s\S]*?<\/div>/gi, '')
    // Simplify to just text-containing elements
    .replace(/<[^>]+>/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()

  // Truncate to reasonable size for GLM
  cleanedContent = cleanedContent.substring(0, 50000)

  return { title, authors, publication, publishDate, description, cleanedContent }
}

/**
 * Extract structured article data from URL
 */
export async function extractArticle(input: ExtractionInput): Promise<ExtractedArticle> {
  const { url, html } = input

  // Step 1: Fetch article content if not provided
  let articleContent = html
  let isMarkdown = false
  let preExtracted: ReturnType<typeof preExtractFromHTML> | null = null

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
        const rawHtml = await fetchDirect(url)
        isMarkdown = false

        // Pre-extract metadata from HTML for fallback
        preExtracted = preExtractFromHTML(rawHtml, url)
        console.log('Pre-extracted metadata:', {
          title: preExtracted.title,
          publication: preExtracted.publication,
          contentLength: preExtracted.cleanedContent.length
        })

        // Use cleaned content instead of raw HTML
        articleContent = preExtracted.cleanedContent
      } catch (directError) {
        throw new Error(`Failed to fetch article from URL: ${directError instanceof Error ? directError.message : 'Unknown error'}`)
      }
    }
  }

  // Step 2: Use GLM-4.5 to extract structured data
  const contentType = isMarkdown ? 'markdown/text' : 'cleaned text'
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

  // Use pre-extracted metadata as fallback when GLM returns empty/default values
  const glmTitle = extractedData.title
  const needsTitleFallback = !glmTitle || glmTitle === 'Untitled Article' || glmTitle.trim() === ''

  // Determine final values with fallback chain
  const finalTitle = needsTitleFallback && preExtracted?.title
    ? preExtracted.title
    : (glmTitle || 'Untitled Article')

  const finalAuthors = (extractedData.authors && extractedData.authors.length > 0)
    ? extractedData.authors
    : (preExtracted?.authors || [])

  const finalPublication = extractedData.publication && extractedData.publication !== 'Unknown Publication'
    ? extractedData.publication
    : (preExtracted?.publication || 'Unknown Publication')

  const finalPublishDate = extractedData.publishDate
    ? extractedData.publishDate
    : (preExtracted?.publishDate || new Date().toISOString().split('T')[0])

  // Log fallback usage
  if (needsTitleFallback && preExtracted?.title) {
    console.log('Using pre-extracted title as fallback:', preExtracted.title)
  }

  const article: ExtractedArticle = {
    id: crypto.randomUUID(),
    url,
    title: finalTitle,
    authors: finalAuthors,
    publication: finalPublication,
    publishDate: finalPublishDate,
    articleType: extractedData.articleType || 'news',
    content: {
      headline: extractedData.content?.headline || finalTitle || '',
      subhead: extractedData.content?.subhead || null,
      lede: extractedData.content?.lede || preExtracted?.description || '',
      body: bodyText || preExtracted?.cleanedContent || '',
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

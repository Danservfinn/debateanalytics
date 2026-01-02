import { NextRequest, NextResponse } from 'next/server'
import { detectDebates } from '@/lib/debate-detection'
import { storeThreadAnalysis, getBatchUserStatus } from '@/lib/neo4j'
import { fetchRedditThread, parseRedditUrl } from '@/lib/reddit-fetcher'
import type { ThreadAnalysisResult, DebatePosition, DebaterArchetype } from '@/types/debate'

// In-memory cache for serverless environments
const analysisCache = new Map<string, { data: ThreadAnalysisResult; cachedAt: number }>()

// Cache expiry: 1 hour for analysis
const CACHE_EXPIRY_MS = 60 * 60 * 1000

interface AnalyzeThreadResponse {
  success: boolean
  data?: ThreadAnalysisResult
  error?: string
  cached?: boolean
  analysisTime?: number
}

/**
 * Check if cached analysis exists and is valid (in-memory)
 */
function getCachedAnalysis(cacheKey: string): ThreadAnalysisResult | null {
  const cached = analysisCache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < CACHE_EXPIRY_MS) {
    return cached.data
  }
  if (cached) {
    analysisCache.delete(cacheKey) // Clean up expired entry
  }
  return null
}

/**
 * Cache the analysis result (in-memory)
 */
function cacheAnalysis(cacheKey: string, data: ThreadAnalysisResult): void {
  // Limit cache size to prevent memory issues
  if (analysisCache.size > 100) {
    // Remove oldest entries
    const entries = Array.from(analysisCache.entries())
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt)
    for (let i = 0; i < 20; i++) {
      analysisCache.delete(entries[i][0])
    }
  }
  analysisCache.set(cacheKey, { data, cachedAt: Date.now() })
}

/**
 * GET /api/analyze-thread
 *
 * Free tier thread analysis with AI debate segmentation.
 * Fetches Reddit thread, detects debates, classifies positions, and scores arguments.
 *
 * Now uses pure TypeScript/fetch - no Python dependency required.
 * Works in serverless environments (Vercel, etc.)
 */
export async function GET(request: NextRequest): Promise<NextResponse<AnalyzeThreadResponse>> {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { success: false, error: 'URL is required' },
      { status: 400 }
    )
  }

  // Validate and parse Reddit URL
  const parsed = parseRedditUrl(url)
  if (!parsed) {
    return NextResponse.json(
      { success: false, error: 'Invalid Reddit URL' },
      { status: 400 }
    )
  }

  const { subreddit, threadId } = parsed
  const cacheKey = `${subreddit}-${threadId}`

  try {
    // Check cache first (in-memory)
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
        analysisTime: Date.now() - startTime
      })
    }

    console.log(`Fetching thread: ${url}`)

    // Fetch thread data using TypeScript fetcher
    let threadData
    try {
      threadData = await fetchRedditThread(url)
    } catch (fetchError: unknown) {
      const error = fetchError as Error
      console.error('Reddit fetch error:', error.message)
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to fetch thread data. Please try again.' },
        { status: 500 }
      )
    }

    const { post, comments } = threadData

    console.log(`Parsed ${comments.length} comments, running debate detection...`)

    // Check if we have Claude API key for AI analysis
    const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY

    let debates: ThreadAnalysisResult['debates'] = []
    let verdict: ThreadAnalysisResult['verdict'] = {
      overallScore: 5,
      summary: 'Basic analysis (AI not configured)',
      evidenceQualityPct: 50,
      civilityScore: 7,
      worthReading: comments.length > 10
    }
    let topics: string[] = []

    if (hasClaudeKey && comments.length > 0) {
      // Run AI debate detection
      const opText = `${post.title}\n\n${post.selftext || ''}`
      const detection = await detectDebates(comments, opText, post.title)
      debates = detection.debates
      verdict = detection.verdict
      topics = detection.topics
    }

    // Get unique authors and check for cached profiles
    const authors = [...new Set(comments.map(c => c.author))]
    let userStatuses: Record<string, { cached: boolean; archetype?: string; overallScore?: number }> = {}

    if (process.env.NEO4J_URI) {
      try {
        userStatuses = await getBatchUserStatus(authors)
      } catch (error) {
        console.error('Neo4j batch status error:', error)
      }
    }

    // Calculate participant summaries
    const participantMap = new Map<string, {
      commentCount: number
      totalQuality: number
      position: DebatePosition
    }>()

    for (const debate of debates) {
      for (const reply of debate.replies) {
        const existing = participantMap.get(reply.author) || {
          commentCount: 0,
          totalQuality: 0,
          position: 'neutral' as DebatePosition
        }
        existing.commentCount++
        existing.totalQuality += reply.qualityScore
        // Take the most recent non-neutral position
        if (reply.position !== 'neutral') {
          existing.position = reply.position
        }
        participantMap.set(reply.author, existing)
      }
    }

    const participants = Array.from(participantMap.entries()).map(([username, data]) => ({
      username,
      commentCount: data.commentCount,
      averageQuality: data.totalQuality / data.commentCount,
      position: data.position,
      archetype: userStatuses[username]?.archetype as DebaterArchetype | undefined,
      isCached: userStatuses[username]?.cached || false
    }))

    // Extract claims and fallacies from debates
    const claims: ThreadAnalysisResult['claims'] = []
    const fallacies: ThreadAnalysisResult['fallacies'] = []

    for (const debate of debates) {
      for (const reply of debate.replies) {
        // Add claims
        if (reply.claims) {
          for (const claim of reply.claims) {
            claims.push({
              id: `claim_${claims.length}`,
              text: claim,
              author: reply.author,
              verdict: 'unverified',
              confidence: 0.5
            })
          }
        }

        // Add fallacies
        if (reply.fallacies) {
          for (const fallacy of reply.fallacies) {
            fallacies.push({
              id: `fallacy_${fallacies.length}`,
              type: fallacy.type,
              author: reply.author,
              quote: fallacy.quote,
              severity: fallacy.severity
            })
          }
        }
      }
    }

    // Build final analysis result
    const analysis: ThreadAnalysisResult = {
      threadId: `${subreddit}-${threadId}`,
      subreddit: post.subreddit,
      title: post.title,
      author: post.author,
      commentCount: comments.length,
      createdAt: new Date(post.created_utc * 1000).toISOString(),
      url: `https://reddit.com${post.permalink}`,
      verdict,
      debates,
      participants,
      claims: claims.slice(0, 50), // Limit to top 50 claims
      fallacies: fallacies.slice(0, 50), // Limit to top 50 fallacies
      topics
    }

    // Store in Neo4j for research data collection (async, don't block response)
    if (process.env.NEO4J_URI) {
      storeThreadAnalysis(analysis).catch(error => {
        console.error('Neo4j storage error:', error)
      })
    }

    // Cache the analysis (in-memory)
    cacheAnalysis(cacheKey, analysis)

    console.log(`Analysis complete: ${debates.length} debates detected in ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      data: analysis,
      cached: false,
      analysisTime: Date.now() - startTime
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/analyze-thread
 *
 * Accepts either:
 * 1. { url: "reddit-url" } - Fetches thread data (may fail from datacenter IPs)
 * 2. { threadData: { post: {...}, comments: [...] }, url: "reddit-url" } - Pre-fetched data
 *
 * For option 2, fetch the Reddit JSON locally:
 *   curl "https://www.reddit.com/r/subreddit/comments/id/.json" > thread.json
 * Then POST: { threadData: <contents of thread.json>, url: "original-url" }
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeThreadResponse>> {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { url, threadData } = body

    // If threadData is provided, use it directly (manual JSON feeding)
    if (threadData && url) {
      const parsed = parseRedditUrl(url)
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'Invalid Reddit URL' },
          { status: 400 }
        )
      }

      const { subreddit, threadId } = parsed
      const cacheKey = `${subreddit}-${threadId}`

      // Check cache first
      const cached = getCachedAnalysis(cacheKey)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          cached: true,
          analysisTime: Date.now() - startTime
        })
      }

      // Parse the raw Reddit JSON format
      let post: { id: string; title: string; author: string; selftext: string; subreddit: string; score: number; upvote_ratio: number; num_comments: number; created_utc: number; permalink: string; url: string }
      let comments: { id: string; author: string; body: string; score: number; created_utc: number; parent_id: string; depth: number; is_op: boolean; controversiality: number; has_delta: boolean }[]

      // Handle raw Reddit API format (array with [post listing, comments listing])
      if (Array.isArray(threadData) && threadData.length >= 2) {
        const postData = threadData[0]?.data?.children?.[0]?.data
        if (!postData) {
          return NextResponse.json(
            { success: false, error: 'Invalid Reddit JSON format - could not extract post data' },
            { status: 400 }
          )
        }

        post = {
          id: String(postData.id || ''),
          title: String(postData.title || ''),
          author: String(postData.author || '[deleted]'),
          selftext: String(postData.selftext || ''),
          subreddit: String(postData.subreddit || ''),
          score: Number(postData.score || 0),
          upvote_ratio: Number(postData.upvote_ratio || 0),
          num_comments: Number(postData.num_comments || 0),
          created_utc: Number(postData.created_utc || 0),
          permalink: String(postData.permalink || ''),
          url: String(postData.url || '')
        }

        // Extract comments recursively
        comments = []
        const extractComments = (children: unknown[], depth: number = 0) => {
          if (!Array.isArray(children)) return
          for (const child of children) {
            const c = child as { kind?: string; data?: Record<string, unknown> }
            if (c.kind !== 't1') continue
            const data = c.data || {}
            const author = String(data.author || '[deleted]')
            const commentBody = String(data.body || '')
            if (author === '[deleted]' || commentBody === '[removed]' || commentBody === '[deleted]') continue

            comments.push({
              id: String(data.id || ''),
              author,
              body: commentBody,
              score: Number(data.score || 0),
              created_utc: Number(data.created_utc || 0),
              parent_id: String(data.parent_id || ''),
              depth,
              is_op: Boolean(data.is_submitter) || author === post.author,
              controversiality: Number(data.controversiality || 0),
              has_delta: /!delta|δ|∆/i.test(commentBody)
            })

            // Recurse into replies
            const replies = data.replies as { data?: { children?: unknown[] } } | undefined
            if (replies?.data?.children) {
              extractComments(replies.data.children, depth + 1)
            }
          }
        }

        const commentsData = threadData[1]?.data?.children || []
        extractComments(commentsData)
      } else if (threadData.post && threadData.comments) {
        // Already parsed format
        post = threadData.post
        comments = threadData.comments
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid threadData format. Expected Reddit JSON array or {post, comments}' },
          { status: 400 }
        )
      }

      console.log(`Processing pre-fetched data: ${comments.length} comments`)

      // Run AI analysis
      const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY
      let debates: ThreadAnalysisResult['debates'] = []
      let verdict: ThreadAnalysisResult['verdict'] = {
        overallScore: 5,
        summary: 'Basic analysis (AI not configured)',
        evidenceQualityPct: 50,
        civilityScore: 7,
        worthReading: comments.length > 10
      }
      let topics: string[] = []

      if (hasClaudeKey && comments.length > 0) {
        const opText = `${post.title}\n\n${post.selftext || ''}`
        const detection = await detectDebates(comments, opText, post.title)
        debates = detection.debates
        verdict = detection.verdict
        topics = detection.topics
      }

      // Get unique authors and check for cached profiles
      const authors = [...new Set(comments.map(c => c.author))]
      let userStatuses: Record<string, { cached: boolean; archetype?: string; overallScore?: number }> = {}

      if (process.env.NEO4J_URI) {
        try {
          userStatuses = await getBatchUserStatus(authors)
        } catch (error) {
          console.error('Neo4j batch status error:', error)
        }
      }

      // Calculate participant summaries
      const participantMap = new Map<string, { commentCount: number; totalQuality: number; position: DebatePosition }>()
      for (const debate of debates) {
        for (const reply of debate.replies) {
          const existing = participantMap.get(reply.author) || { commentCount: 0, totalQuality: 0, position: 'neutral' as DebatePosition }
          existing.commentCount++
          existing.totalQuality += reply.qualityScore
          if (reply.position !== 'neutral') existing.position = reply.position
          participantMap.set(reply.author, existing)
        }
      }

      const participants = Array.from(participantMap.entries()).map(([username, data]) => ({
        username,
        commentCount: data.commentCount,
        averageQuality: data.totalQuality / data.commentCount,
        position: data.position,
        archetype: userStatuses[username]?.archetype as DebaterArchetype | undefined,
        isCached: userStatuses[username]?.cached || false
      }))

      // Extract claims and fallacies
      const claims: ThreadAnalysisResult['claims'] = []
      const fallacies: ThreadAnalysisResult['fallacies'] = []
      for (const debate of debates) {
        for (const reply of debate.replies) {
          if (reply.claims) {
            for (const claim of reply.claims) {
              claims.push({ id: `claim_${claims.length}`, text: claim, author: reply.author, verdict: 'unverified', confidence: 0.5 })
            }
          }
          if (reply.fallacies) {
            for (const fallacy of reply.fallacies) {
              fallacies.push({ id: `fallacy_${fallacies.length}`, type: fallacy.type, author: reply.author, quote: fallacy.quote, severity: fallacy.severity })
            }
          }
        }
      }

      const analysis: ThreadAnalysisResult = {
        threadId: `${subreddit}-${threadId}`,
        subreddit: post.subreddit,
        title: post.title,
        author: post.author,
        commentCount: comments.length,
        createdAt: new Date(post.created_utc * 1000).toISOString(),
        url: `https://reddit.com${post.permalink}`,
        verdict,
        debates,
        participants,
        claims: claims.slice(0, 50),
        fallacies: fallacies.slice(0, 50),
        topics
      }

      // Store and cache
      if (process.env.NEO4J_URI) {
        storeThreadAnalysis(analysis).catch(error => console.error('Neo4j storage error:', error))
      }
      cacheAnalysis(cacheKey, analysis)

      console.log(`Analysis complete: ${debates.length} debates detected in ${Date.now() - startTime}ms`)

      return NextResponse.json({
        success: true,
        data: analysis,
        cached: false,
        analysisTime: Date.now() - startTime
      })
    }

    // Traditional URL-based fetch
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required in request body' },
        { status: 400 }
      )
    }

    // Create a mock GET request with the URL
    const mockUrl = new URL(request.url)
    mockUrl.searchParams.set('url', url)

    const mockRequest = new NextRequest(mockUrl.toString())
    return GET(mockRequest)

  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

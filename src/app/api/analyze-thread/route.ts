import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { detectDebates } from '@/lib/debate-detection'
import { storeThreadAnalysis, getBatchUserStatus } from '@/lib/neo4j'
import type { ThreadAnalysisResult, DebatePosition, DebaterArchetype } from '@/types/debate'

const execAsync = promisify(exec)

// Cache directories
const RAW_CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'threads')
const ANALYSIS_CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'analysis')

// Cache expiry: 1 hour for analysis
const CACHE_EXPIRY_MS = 60 * 60 * 1000

interface CachedAnalysis {
  data: ThreadAnalysisResult
  cachedAt: number
}

interface AnalyzeThreadResponse {
  success: boolean
  data?: ThreadAnalysisResult
  error?: string
  cached?: boolean
  analysisTime?: number
}

interface RawComment {
  id: string
  author: string
  body: string
  score: number
  created_utc: number
  parent_id: string
  depth?: number
}

/**
 * Parse Reddit API response into flat comment list
 */
function parseComments(data: unknown[], depth: number = 0): RawComment[] {
  const comments: RawComment[] = []

  for (const item of data) {
    const itemData = item as { kind?: string; data?: Record<string, unknown> }
    if (itemData.kind === 't1' && itemData.data) {
      const comment = itemData.data as {
        id?: string
        author?: string
        body?: string
        score?: number
        created_utc?: number
        parent_id?: string
        replies?: { data?: { children?: unknown[] } } | string
      }

      if (comment.author !== '[deleted]' && comment.body && comment.body !== '[removed]') {
        comments.push({
          id: String(comment.id || ''),
          author: String(comment.author || ''),
          body: String(comment.body || ''),
          score: Number(comment.score || 0),
          created_utc: Number(comment.created_utc || 0),
          parent_id: String(comment.parent_id || ''),
          depth
        })

        // Parse nested replies
        if (comment.replies && typeof comment.replies === 'object') {
          const repliesData = comment.replies as { data?: { children?: unknown[] } }
          if (repliesData.data?.children) {
            comments.push(...parseComments(repliesData.data.children, depth + 1))
          }
        }
      }
    } else if (itemData.kind === 'Listing' && itemData.data) {
      const listingData = itemData.data as { children?: unknown[] }
      if (listingData.children) {
        comments.push(...parseComments(listingData.children, depth))
      }
    }
  }

  return comments
}

/**
 * Check if cached analysis exists and is valid
 */
async function getCachedAnalysis(cacheKey: string): Promise<ThreadAnalysisResult | null> {
  try {
    const cacheFile = path.join(ANALYSIS_CACHE_DIR, `${cacheKey}.json`)
    const data = await readFile(cacheFile, 'utf-8')
    const cached: CachedAnalysis = JSON.parse(data)

    if (Date.now() - cached.cachedAt < CACHE_EXPIRY_MS) {
      return cached.data
    }
    return null
  } catch {
    return null
  }
}

/**
 * Cache the analysis result
 */
async function cacheAnalysis(cacheKey: string, data: ThreadAnalysisResult): Promise<void> {
  try {
    await mkdir(ANALYSIS_CACHE_DIR, { recursive: true })
    const cacheFile = path.join(ANALYSIS_CACHE_DIR, `${cacheKey}.json`)
    const cached: CachedAnalysis = {
      data,
      cachedAt: Date.now()
    }
    await writeFile(cacheFile, JSON.stringify(cached, null, 2))
  } catch (error) {
    console.error('Failed to cache analysis:', error)
  }
}

/**
 * GET /api/analyze-thread
 *
 * Free tier thread analysis with AI debate segmentation.
 * Fetches Reddit thread, detects debates, classifies positions, and scores arguments.
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

  // Validate Reddit URL
  const redditUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:old\.)?(?:new\.)?reddit\.com\/r\/(\w+)\/comments\/(\w+)/i
  const match = url.match(redditUrlPattern)

  if (!match) {
    return NextResponse.json(
      { success: false, error: 'Invalid Reddit URL' },
      { status: 400 }
    )
  }

  const [, subreddit, threadId] = match
  const cacheKey = `${subreddit}-${threadId}`

  try {
    // Check cache first
    const cached = await getCachedAnalysis(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
        analysisTime: Date.now() - startTime
      })
    }

    // Ensure cache directories exist
    await mkdir(RAW_CACHE_DIR, { recursive: true })
    await mkdir(ANALYSIS_CACHE_DIR, { recursive: true })

    // Fetch raw thread data using Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'reddit_debate_fetcher.py')
    const outputPath = path.join(RAW_CACHE_DIR, cacheKey)
    const command = `python3 "${scriptPath}" "${url}" --output "${outputPath}" --raw`

    console.log(`Fetching thread: ${url}`)

    try {
      await execAsync(command, {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
      })
    } catch (execError: unknown) {
      const error = execError as { message?: string; stderr?: string }
      console.error('Script execution error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch thread data. Please try again.' },
        { status: 500 }
      )
    }

    // Read the raw JSON file
    const jsonFile = `${outputPath}.json`
    const rawData = await readFile(jsonFile, 'utf-8')
    const threadData = JSON.parse(rawData)

    // Extract post data
    const post = threadData[0]?.data?.children?.[0]?.data
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Could not parse thread data' },
        { status: 500 }
      )
    }

    // Parse all comments
    const commentsData = threadData[1]?.data?.children || []
    const comments = parseComments(commentsData, 1)

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

    // Cache the analysis
    await cacheAnalysis(cacheKey, analysis)

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
 * Alternative POST method for the same functionality
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeThreadResponse>> {
  try {
    const body = await request.json()
    const { url } = body

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

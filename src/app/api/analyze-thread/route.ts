import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, mkdir } from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

// Cache directory for thread data
const CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'threads')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { success: false, error: 'URL is required' },
      { status: 400 }
    )
  }

  // Validate Reddit URL
  const redditUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:old\.)?(?:new\.)?reddit\.com\/r\/\w+\/comments\/\w+/i
  if (!redditUrlPattern.test(url)) {
    return NextResponse.json(
      { success: false, error: 'Invalid Reddit URL' },
      { status: 400 }
    )
  }

  // Extract thread ID from URL for caching
  const match = url.match(/\/r\/(\w+)\/comments\/(\w+)/)
  if (!match) {
    return NextResponse.json(
      { success: false, error: 'Could not parse Reddit URL' },
      { status: 400 }
    )
  }

  const [, subreddit, threadId] = match
  const cacheFile = path.join(CACHE_DIR, `${subreddit}-${threadId}.json`)

  try {
    // Ensure cache directory exists
    await mkdir(CACHE_DIR, { recursive: true })

    // Run Python script to fetch thread
    const scriptPath = path.join(process.cwd(), 'scripts', 'reddit_debate_fetcher.py')
    const outputPath = path.join(CACHE_DIR, `${subreddit}-${threadId}`)
    const command = `python3 "${scriptPath}" "${url}" --output "${outputPath}" --raw`

    try {
      await execAsync(command, {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
      })

      // Read the raw JSON file
      const jsonFile = `${outputPath}.json`
      const rawData = await readFile(jsonFile, 'utf-8')
      const threadData = JSON.parse(rawData)

      // Transform to ThreadAnalysis format
      const post = threadData[0]?.data?.children?.[0]?.data
      if (!post) {
        return NextResponse.json(
          { success: false, error: 'Could not parse thread data' },
          { status: 500 }
        )
      }

      // Basic transformation (full analysis would require more processing)
      const analysis = {
        id: `${subreddit}-${threadId}`,
        metadata: {
          id: threadId,
          title: post.title,
          subreddit: post.subreddit,
          author: post.author,
          score: post.score,
          upvoteRatio: post.upvote_ratio,
          numComments: post.num_comments,
          createdUtc: post.created_utc,
          url: `https://reddit.com${post.permalink}`,
          selftext: post.selftext
        },
        fetchedAt: new Date().toISOString(),
        statistics: {
          totalComments: post.num_comments,
          uniqueAuthors: 0,
          opReplies: 0,
          deltaAwards: 0,
          topLevelComments: 0,
          avgScore: 0,
          strongArguments: 0,
          weakArguments: 0,
          totalFallacies: 0,
          avgArgumentQuality: 5
        },
        comments: [],
        topArguments: [],
        fallacyBreakdown: [],
        participants: []
      }

      return NextResponse.json({
        success: true,
        data: analysis,
        cached: false
      })
    } catch (execError: unknown) {
      const error = execError as { message?: string; stderr?: string }
      console.error('Script execution error:', error)

      return NextResponse.json(
        { success: false, error: 'Failed to fetch thread data. Please try again.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

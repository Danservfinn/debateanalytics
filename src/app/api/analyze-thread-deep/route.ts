import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import type { DeepAnalysis, DeepAnalysisResponse } from '@/types/analysis'

const execAsync = promisify(exec)

// Cache directory for deep analysis results
const CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'deep-analysis')

// Cache expiry: 24 hours
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000

interface CachedAnalysis {
  data: DeepAnalysis
  cachedAt: number
}

function convertSnakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    const value = obj[key]
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = convertSnakeToCamel(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map(item =>
        typeof item === 'object' && item !== null
          ? convertSnakeToCamel(item as Record<string, unknown>)
          : item
      )
    } else {
      result[camelKey] = value
    }
  }
  return result
}

async function getCachedAnalysis(threadId: string): Promise<DeepAnalysis | null> {
  try {
    const cacheFile = path.join(CACHE_DIR, `${threadId}.json`)
    const data = await readFile(cacheFile, 'utf-8')
    const cached: CachedAnalysis = JSON.parse(data)

    // Check if cache is still valid
    if (Date.now() - cached.cachedAt < CACHE_EXPIRY_MS) {
      return cached.data
    }
    return null
  } catch {
    return null
  }
}

async function cacheAnalysis(threadId: string, data: DeepAnalysis): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    const cacheFile = path.join(CACHE_DIR, `${threadId}.json`)
    const cached: CachedAnalysis = {
      data,
      cachedAt: Date.now()
    }
    await writeFile(cacheFile, JSON.stringify(cached, null, 2))
  } catch (error) {
    console.error('Failed to cache analysis:', error)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<DeepAnalysisResponse>> {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { url } = body

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

    // Get API key from environment
    const apiKey = process.env.ZHIPUAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Analysis service not configured' },
        { status: 500 }
      )
    }

    // Run the GLM-4 analysis script
    const scriptPath = path.join(process.cwd(), 'scripts', 'glm4_debate_analyzer.py')
    const outputPath = path.join(CACHE_DIR, `${cacheKey}-temp.json`)

    // Ensure cache directory exists
    await mkdir(CACHE_DIR, { recursive: true })

    const command = `python3 "${scriptPath}" --url "${url}" --output "${outputPath}" --model glm-4-plus`

    console.log(`Running deep analysis for ${url}...`)

    try {
      await execAsync(command, {
        timeout: 300000, // 5 minute timeout for deep analysis
        maxBuffer: 50 * 1024 * 1024,
        env: {
          ...process.env,
          ZHIPUAI_API_KEY: apiKey
        }
      })

      // Read the output file
      const rawData = await readFile(outputPath, 'utf-8')
      const snakeCaseData = JSON.parse(rawData)

      // Convert snake_case to camelCase for frontend
      const analysis = convertSnakeToCamel(snakeCaseData) as unknown as DeepAnalysis

      // Cache the result
      await cacheAnalysis(cacheKey, analysis)

      return NextResponse.json({
        success: true,
        data: analysis,
        cached: false,
        analysisTime: Date.now() - startTime
      })

    } catch (execError: unknown) {
      const error = execError as { message?: string; stderr?: string; stdout?: string }
      console.error('Analysis script error:', error.stderr || error.message)

      return NextResponse.json(
        {
          success: false,
          error: 'Analysis failed. The thread may be too large or the service is temporarily unavailable.'
        },
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

// Also support GET for simpler testing
export async function GET(request: NextRequest): Promise<NextResponse<DeepAnalysisResponse>> {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { success: false, error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  // Create a mock request body and call POST handler
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  return POST(mockRequest)
}

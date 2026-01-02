import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import type { DeepAnalysis, DeepAnalysisResponse, Claim } from '@/types/analysis'
import {
  loadRegistry,
  saveRegistry,
  hashClaim,
  lookupClaim,
  registerClaim
} from '@/lib/claims-registry'

const execAsync = promisify(exec)

// Cache directory for deep analysis results (PUBLIC - available to all users)
const CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'deep-analysis')

// NO expiry - analyses are permanent and public
interface CachedAnalysis {
  data: DeepAnalysis
  cachedAt: number
  publiclyAvailable: boolean  // Always true - all analyses are public
  contributedBy?: string      // Optional: track who ran the analysis
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

    // Analyses are PERMANENT - no expiry check
    // Once analyzed, always available to everyone
    return cached.data
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
      cachedAt: Date.now(),
      publiclyAvailable: true  // All analyses are public
    }
    await writeFile(cacheFile, JSON.stringify(cached, null, 2))
  } catch (error) {
    console.error('Failed to cache analysis:', error)
  }
}

/**
 * Register all verified claims from an analysis to the global claims registry.
 * Once registered, these verifications become "sticky" and reusable.
 */
async function registerClaimsFromAnalysis(
  analysis: DeepAnalysis,
  threadId: string
): Promise<{ registered: number; fromCache: number }> {
  let registered = 0
  let fromCache = 0

  if (!analysis.claims || analysis.claims.length === 0) {
    return { registered, fromCache }
  }

  for (const claim of analysis.claims) {
    // Skip unverified claims - they can be re-checked later
    if (claim.verificationStatus === 'unverified') {
      continue
    }

    // Check if already in registry
    const existing = await lookupClaim(claim.text)
    if (existing) {
      // Mark this claim as from cache and add provenance
      claim.fromCache = true
      claim.registryId = existing.id
      claim.verifiedAt = existing.verifiedAt
      claim.sticky = true
      fromCache++
    } else {
      // Register new claim
      const registered_claim = await registerClaim(
        claim.text,
        claim.verificationStatus as 'verified' | 'disputed' | 'false' | 'sourced',
        {
          confidence: Math.round(claim.relevanceScore),
          sources: claim.sourceUrl ? [claim.sourceUrl] : [],
          threadId,
          verifiedBy: 'claude'
        }
      )

      // Update claim with registry info
      claim.fromCache = false
      claim.registryId = registered_claim.id
      claim.verifiedAt = registered_claim.verifiedAt
      claim.sticky = true
      registered++
    }
  }

  return { registered, fromCache }
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

    // Get API key from environment (try Claude first, fall back to ZhipuAI)
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const zhipuKey = process.env.ZHIPUAI_API_KEY

    const apiKey = anthropicKey || zhipuKey
    const useClaude = !!anthropicKey

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Analysis service not configured. Set ANTHROPIC_API_KEY or ZHIPUAI_API_KEY.' },
        { status: 500 }
      )
    }

    // Run the analysis script (Claude or GLM-4 based on available key)
    const scriptName = useClaude ? 'claude_debate_analyzer.py' : 'glm4_debate_analyzer.py'
    const scriptPath = path.join(process.cwd(), 'scripts', scriptName)
    const outputPath = path.join(CACHE_DIR, `${cacheKey}-temp.json`)

    // Ensure cache directory exists
    await mkdir(CACHE_DIR, { recursive: true })

    const model = useClaude ? 'claude-sonnet-4-20250514' : 'glm-4-plus'
    const command = `python3 "${scriptPath}" --url "${url}" --output "${outputPath}" --model ${model}`

    console.log(`Running deep analysis for ${url} with ${useClaude ? 'Claude' : 'GLM-4'}...`)

    try {
      await execAsync(command, {
        timeout: 300000, // 5 minute timeout for deep analysis
        maxBuffer: 50 * 1024 * 1024,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: anthropicKey || '',
          ZHIPUAI_API_KEY: zhipuKey || ''
        }
      })

      // Read the output file
      const rawData = await readFile(outputPath, 'utf-8')
      const snakeCaseData = JSON.parse(rawData)

      // Convert snake_case to camelCase for frontend
      const analysis = convertSnakeToCamel(snakeCaseData) as unknown as DeepAnalysis

      // Register verified claims to the global registry (makes them "sticky")
      const { registered, fromCache } = await registerClaimsFromAnalysis(analysis, cacheKey)
      console.log(`Claims registered: ${registered} new, ${fromCache} from cache`)

      // Cache the result (PERMANENT & PUBLIC - available to all users)
      await cacheAnalysis(cacheKey, analysis)

      return NextResponse.json({
        success: true,
        data: analysis,
        cached: false,
        analysisTime: Date.now() - startTime,
        claimsRegistered: registered,
        claimsFromCache: fromCache
      } as DeepAnalysisResponse & { claimsRegistered: number; claimsFromCache: number })

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

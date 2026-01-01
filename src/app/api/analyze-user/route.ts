import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile, stat, writeFile, mkdir } from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

// Cache directory for user data
const CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'users')
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')

  if (!username) {
    return NextResponse.json(
      { success: false, error: 'Username is required' },
      { status: 400 }
    )
  }

  // Sanitize username (alphanumeric, underscores, hyphens only)
  const sanitizedUsername = username.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
  if (!sanitizedUsername || sanitizedUsername.length > 50) {
    return NextResponse.json(
      { success: false, error: 'Invalid username' },
      { status: 400 }
    )
  }

  const cacheFile = path.join(CACHE_DIR, `${sanitizedUsername}.json`)

  try {
    // Check cache first
    try {
      const stats = await stat(cacheFile)
      const age = Date.now() - stats.mtimeMs

      if (age < CACHE_MAX_AGE_MS) {
        // Return cached data
        const cached = await readFile(cacheFile, 'utf-8')
        return NextResponse.json({
          success: true,
          data: JSON.parse(cached),
          cached: true
        })
      }
    } catch {
      // Cache miss, continue to fetch
    }

    // Ensure cache directory exists
    await mkdir(CACHE_DIR, { recursive: true })

    // Run Python script to fetch and analyze user
    const scriptPath = path.join(process.cwd(), 'scripts', 'reddit_user_fetcher.py')
    const command = `python3 "${scriptPath}" "${sanitizedUsername}" --limit 100 --radar --output "${cacheFile}"`

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      // Check if file was created
      const data = await readFile(cacheFile, 'utf-8')
      const userData = JSON.parse(data)

      return NextResponse.json({
        success: true,
        data: userData,
        cached: false
      })
    } catch (execError: unknown) {
      const error = execError as { message?: string; stderr?: string }
      console.error('Script execution error:', error)

      // Try to provide helpful error message
      if (error.stderr?.includes('No comments found')) {
        return NextResponse.json(
          { success: false, error: 'User not found or has no comment history' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to fetch user data. Please try again.' },
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

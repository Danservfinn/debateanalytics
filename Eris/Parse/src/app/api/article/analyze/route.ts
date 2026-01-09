/**
 * Article Analysis API
 * Runs full analysis without database dependency (MVP version)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runFullAnalysis } from "@/lib/orchestrator"
import type { AnalyzeResponse } from "@/types"

// Extend function timeout for LLM analysis (up to 60s on Pro, 300s on Enterprise)
// Hobby plan is limited to 10s regardless of this setting
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { url, analysisType } = body

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Article URL is required" },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // Run analysis (MVP: no credit checks, no database)
    const analysis = await runFullAnalysis(url, userId)

    const response: AnalyzeResponse = {
      success: true,
      data: analysis,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Analysis error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze article",
      },
      { status: 500 }
    )
  }
}

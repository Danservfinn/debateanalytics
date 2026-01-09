/**
 * Article Analysis API
 * Runs full analysis and persists to database
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runFullAnalysis } from "@/lib/orchestrator"
import { prisma } from "@/lib/prisma"
import type { AnalyzeResponse, ParseAnalysis } from "@/types"

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

    // Run full analysis
    const analysis = await runFullAnalysis(url, userId)

    // Save to database in background (don't block response)
    saveAnalysisToDatabase(analysis, userId).catch(error => {
      console.error("Failed to save analysis to database:", error)
    })

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

/**
 * Saves analysis to database for history and sharing
 */
async function saveAnalysisToDatabase(analysis: ParseAnalysis, userId: string) {
  try {
    // First, upsert the article
    const articleData = {
      title: analysis.articleMetadata?.title || "Untitled",
      authors: analysis.articleMetadata?.authors || [],
      publication: analysis.articleMetadata?.publication || "Unknown",
      publishDate: analysis.articleMetadata?.publishDate || new Date().toISOString(),
      articleType: analysis.articleMetadata?.articleType || "news",
      extractedContent: analysis.articleMetadata || {}, // Store full metadata as JSON
      emotionalLanguageDensity: analysis.articleMetadata?.emotionalLanguageDensity || 0,
    }

    const article = await prisma.article.upsert({
      where: { url: analysis.url },
      update: articleData,
      create: {
        url: analysis.url,
        ...articleData,
      },
    })

    // Create the analysis record
    await prisma.analysis.create({
      data: {
        id: analysis.id,
        userId,
        articleId: article.id,
        articleUrl: analysis.url,
        truthScore: analysis.truthScore,
        credibility: analysis.credibility,
        scoreBreakdown: analysis.scoreBreakdown as object || {},
        steelMannedPerspectives: (analysis.steelMannedPerspectives || []) as object[],
        manipulationRisk: analysis.manipulationRisk as object || {},
        deceptionDetected: (analysis.deceptionDetected || []) as object[],
        fallacies: (analysis.fallacies || []) as object[],
        factCheckResults: (analysis.factCheckResults || []) as object[],
        whatAiThinks: analysis.whatAiThinks || "",
        analysisDuration: Math.round(analysis.analysisDuration),
        agentsUsed: analysis.agentsUsed || [],
        modelVersion: analysis.modelVersion || "glm-4.7",
        analysisType: "full", // Default to full analysis
      },
    })

    console.log("Analysis saved to database:", analysis.id)
  } catch (error) {
    // If the analysis already exists (unique constraint), that's fine
    if ((error as { code?: string }).code === "P2002") {
      console.log("Analysis already exists in database:", analysis.id)
      return
    }
    throw error
  }
}

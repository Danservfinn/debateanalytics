/**
 * Single Analysis API
 * Returns full analysis data by ID
 * Supports both authenticated (owner) and public (shared) access
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ analysisId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { analysisId } = await params;

    if (!analysisId) {
      return NextResponse.json(
        { success: false, error: "Analysis ID is required" },
        { status: 400 }
      );
    }

    // Get session (optional - for checking ownership)
    const session = await auth();

    // Fetch analysis with article data
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        article: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: "Analysis not found" },
        { status: 404 }
      );
    }

    // Check if user is the owner
    const isOwner = session?.user?.id === analysis.userId;

    // Transform to ParseAnalysis format for frontend
    const formattedAnalysis = {
      id: analysis.id,
      url: analysis.articleUrl,
      truthScore: analysis.truthScore,
      credibility: analysis.credibility,
      scoreBreakdown: analysis.scoreBreakdown,
      steelMannedPerspectives: analysis.steelMannedPerspectives,
      manipulationRisk: analysis.manipulationRisk,
      deceptionDetected: analysis.deceptionDetected,
      fallacies: analysis.fallacies,
      factCheckResults: analysis.factCheckResults,
      whatAiThinks: analysis.whatAiThinks,
      analysisDuration: analysis.analysisDuration,
      agentsUsed: analysis.agentsUsed,
      modelVersion: analysis.modelVersion,
      createdAt: analysis.createdAt.toISOString(),
      articleMetadata: {
        title: analysis.article.title,
        authors: analysis.article.authors,
        publication: analysis.article.publication,
        publishDate: analysis.article.publishDate,
        articleType: analysis.article.articleType,
        emotionalLanguageDensity: analysis.article.emotionalLanguageDensity,
        extractedContent: analysis.article.extractedContent,
      },
      // For shared view
      authorName: analysis.user.name,
      isOwner,
    };

    return NextResponse.json({
      success: true,
      data: formattedAnalysis,
    });
  } catch (error) {
    console.error("Analysis fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch analysis",
      },
      { status: 500 }
    );
  }
}

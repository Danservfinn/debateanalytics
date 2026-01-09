/**
 * Save Analysis API
 * Saves completed analysis to database for history and sharing
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ParseAnalysis } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const analysis: ParseAnalysis = body.analysis;

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: "Analysis data is required" },
        { status: 400 }
      );
    }

    // Upsert the article first
    const article = await prisma.article.upsert({
      where: { url: analysis.url },
      update: {
        title: analysis.articleMetadata?.title || "Untitled",
        authors: analysis.articleMetadata?.authors || [],
        publication: analysis.articleMetadata?.publication || "Unknown",
        publishDate: analysis.articleMetadata?.publishDate || new Date().toISOString().split('T')[0],
        articleType: analysis.articleMetadata?.articleType || "news",
        extractedContent: analysis.articleMetadata as any || {},
        emotionalLanguageDensity: analysis.articleMetadata?.emotionalLanguageDensity || 0,
      },
      create: {
        url: analysis.url,
        title: analysis.articleMetadata?.title || "Untitled",
        authors: analysis.articleMetadata?.authors || [],
        publication: analysis.articleMetadata?.publication || "Unknown",
        publishDate: analysis.articleMetadata?.publishDate || new Date().toISOString().split('T')[0],
        articleType: analysis.articleMetadata?.articleType || "news",
        extractedContent: analysis.articleMetadata as any || {},
        emotionalLanguageDensity: analysis.articleMetadata?.emotionalLanguageDensity || 0,
      },
    });

    // Create the analysis record
    const savedAnalysis = await prisma.analysis.create({
      data: {
        id: analysis.id,
        userId: session.user.id,
        articleId: article.id,
        articleUrl: analysis.url,
        truthScore: analysis.truthScore,
        credibility: analysis.credibility,
        scoreBreakdown: analysis.scoreBreakdown as any,
        steelMannedPerspectives: analysis.steelMannedPerspectives as any || [],
        manipulationRisk: analysis.manipulationRisk as any || {},
        deceptionDetected: analysis.deceptionDetected as any[] || [],
        fallacies: analysis.fallacies as any[] || [],
        factCheckResults: analysis.factCheckResults as any[] || [],
        whatAiThinks: analysis.whatAiThinks || "",
        analysisDuration: analysis.analysisDuration || 0,
        agentsUsed: analysis.agentsUsed || [],
        modelVersion: analysis.modelVersion || "glm-4.7",
        analysisType: "full",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        analysisId: savedAnalysis.id,
        articleId: article.id,
      },
    });
  } catch (error) {
    console.error("Analysis save error:", error);

    // Handle duplicate key error gracefully
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({
        success: true,
        message: "Analysis already saved",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save analysis",
      },
      { status: 500 }
    );
  }
}

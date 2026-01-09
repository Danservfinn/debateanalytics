/**
 * Analyses List API
 * Returns user's analysis history with pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.analysis.count({
      where: { userId: session.user.id },
    });

    // Get analyses with article info
    const analyses = await prisma.analysis.findMany({
      where: { userId: session.user.id },
      include: {
        article: {
          select: {
            title: true,
            publication: true,
            publishDate: true,
            articleType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    // Transform for frontend
    const formattedAnalyses = analyses.map((a) => ({
      id: a.id,
      articleUrl: a.articleUrl,
      articleTitle: a.article.title,
      publication: a.article.publication,
      publishDate: a.article.publishDate,
      articleType: a.article.articleType,
      truthScore: a.truthScore,
      credibility: a.credibility,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        analyses: formattedAnalyses,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Analyses fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch analyses",
      },
      { status: 500 }
    );
  }
}

/**
 * Main Analysis Page - The Newsroom
 * URL input → Extract → Preview → Analyze flow
 */

'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { ArticleUploader } from "@/components/article/ArticleUploader";
import type { ExtractedArticle } from "@/types";

export default function AnalyzePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleExtract = async (url: string): Promise<ExtractedArticle> => {
    const response = await fetch("/api/article/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to extract article");
    }

    return data.data;
  };

  const handleConfirm = async (article: ExtractedArticle, analysisType: 'free' | 'full') => {
    setIsAnalyzing(true);

    try {
      // First, save the extracted article to database
      const saveResponse = await fetch("/api/article/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: article.url,
          extractedContent: article,
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveData.success) {
        throw new Error(saveData.error || "Failed to save article");
      }

      // Then run the analysis
      const analyzeResponse = await fetch("/api/article/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: saveData.data.id,
          analysisType,
        }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeData.success) {
        throw new Error(analyzeData.error || "Failed to analyze article");
      }

      // Navigate to results page
      if (analyzeData.data.id) {
        router.push(`/analyze/result/${analyzeData.data.id}`);
      } else if (analyzeData.data.jobId) {
        // If queued, show queue status
        router.push(`/analyze/queue/${analyzeData.data.jobId}`);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert(error instanceof Error ? error.message : 'Failed to analyze article');
      setIsAnalyzing(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6">
          {/* Loading Animation - Editorial Style */}
          <div className="relative">
            <div className="w-16 h-16 border-2 border-border mx-auto flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <div>
            <p className="font-headline text-2xl text-foreground mb-2">Analysis in Progress</p>
            <p className="font-body text-muted-foreground">
              Our seven-agent system is evaluating your article.<br />
              This typically takes 30-60 seconds.
            </p>
          </div>
          {/* Progress Indicators */}
          <div className="flex justify-center gap-2">
            <div className="w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Page Header - Editorial Style */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <span className="badge-section mb-4 inline-block">Analysis</span>
            <h1 className="font-headline text-4xl md:text-5xl text-foreground mb-4">
              Submit an Article
            </h1>
            <p className="font-deck text-xl text-muted-foreground">
              Paste any news article URL for comprehensive truth analysis.
              Our AI examines claims, detects manipulation, and delivers
              an evidence-based assessment.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <ArticleUploader onExtract={handleExtract} onConfirm={handleConfirm} />

          {/* How It Works - Miller's Law: 3 steps shown */}
          <div className="mt-16 pt-12 border-t border-border">
            <h2 className="font-section text-muted-foreground mb-8 text-center">What Happens Next</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="font-masthead text-4xl text-primary/30 mb-3">1</div>
                <h3 className="font-headline text-lg text-foreground mb-2">Extraction</h3>
                <p className="text-sm text-muted-foreground">
                  We parse the article content, identify claims, sources, and rhetorical structures.
                </p>
              </div>
              <div className="text-center">
                <div className="font-masthead text-4xl text-primary/30 mb-3">2</div>
                <h3 className="font-headline text-lg text-foreground mb-2">Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Seven specialized AI agents evaluate evidence, logic, bias, and manipulation.
                </p>
              </div>
              <div className="text-center">
                <div className="font-masthead text-4xl text-primary/30 mb-3">3</div>
                <h3 className="font-headline text-lg text-foreground mb-2">Report</h3>
                <p className="text-sm text-muted-foreground">
                  Receive a comprehensive truth score with detailed breakdown and insights.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

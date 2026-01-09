/**
 * Main Analysis Page - The Newsroom
 * URL input → Extract → Preview → Analyze flow
 */

'use client';

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { ArticleUploader } from "@/components/article/ArticleUploader";
import type { ExtractedArticle } from "@/types";

// Inner component that uses useSearchParams (needs Suspense boundary)
// Agent configuration with estimated completion times (ms)
const AGENTS = [
  { name: 'Extraction', desc: 'Parsing article structure', duration: 8000 },
  { name: 'Steel-Man', desc: 'Analyzing perspectives', duration: 15000 },
  { name: 'Deception', desc: 'Detecting manipulation', duration: 20000 },
  { name: 'Persuasion', desc: 'Detecting opinion influence', duration: 25000 },
  { name: 'Fact-Check', desc: 'Verifying claims', duration: 35000 },
  { name: 'Synthesis', desc: 'Generating insights', duration: 45000 },
];

function AnalyzePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [completedAgents, setCompletedAgents] = useState<Set<string>>(new Set());

  // Get URL from query params (for re-analyze functionality)
  const initialUrl = searchParams.get('url') || '';

  // Animate agent completion when analyzing
  useEffect(() => {
    if (!isAnalyzing) {
      setCompletedAgents(new Set());
      return;
    }

    const timers: NodeJS.Timeout[] = [];

    AGENTS.forEach((agent) => {
      const timer = setTimeout(() => {
        setCompletedAgents(prev => new Set([...prev, agent.name]));
      }, agent.duration);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [isAnalyzing]);

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
      // Run the analysis directly with URL (MVP: no database save)
      console.log('Starting analysis for:', article.url);
      const analyzeResponse = await fetch("/api/article/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: article.url,
          analysisType,
        }),
      });

      console.log('Response status:', analyzeResponse.status);

      // Handle non-JSON responses (timeouts, server errors)
      const contentType = analyzeResponse.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await analyzeResponse.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server error (${analyzeResponse.status}): The analysis may have timed out. Try a shorter article.`);
      }

      const analyzeData = await analyzeResponse.json();
      console.log('Response data:', analyzeData);

      if (!analyzeData.success) {
        throw new Error(analyzeData.error || "Failed to analyze article");
      }

      // Navigate to results page with analysis data in state
      if (analyzeData.data?.id) {
        // Store analysis in sessionStorage for the results page
        const storageKey = `analysis_${analyzeData.data.id}`;
        console.log('Storing analysis with key:', storageKey);
        sessionStorage.setItem(storageKey, JSON.stringify(analyzeData.data));

        // Verify storage worked
        const stored = sessionStorage.getItem(storageKey);
        console.log('Verified storage:', stored ? 'success' : 'FAILED');

        router.push(`/analyze/result/${analyzeData.data.id}`);
      } else if (analyzeData.data?.jobId) {
        // If queued, show queue status
        router.push(`/analyze/queue/${analyzeData.data.jobId}`);
      } else {
        console.error('No id or jobId in response:', analyzeData);
        throw new Error('Analysis completed but no result ID was returned');
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4">
          {/* Main Card */}
          <div className="border border-border bg-card p-8 space-y-8">
            {/* Header with Spinner */}
            <div className="text-center space-y-4">
              <div className="relative inline-block">
                <div className="w-20 h-20 border border-border flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary animate-pulse" />
              </div>
              <div>
                <p className="font-headline text-2xl text-foreground">Analysis in Progress</p>
                <p className="font-body text-sm text-muted-foreground mt-1">
                  This typically takes a few minutes
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Agent Steps */}
            <div className="space-y-3">
              <p className="font-section text-xs text-muted-foreground tracking-wider">ACTIVE AGENTS</p>
              <div className="space-y-2">
                {AGENTS.map((agent, i) => {
                  const isCompleted = completedAgents.has(agent.name);
                  return (
                    <div
                      key={agent.name}
                      className={`flex items-center gap-3 py-2 px-3 border-l-2 transition-all duration-500 ${
                        isCompleted
                          ? 'bg-emerald-50 border-emerald-500'
                          : 'bg-muted/30 border-primary/50'
                      }`}
                    >
                      {isCompleted ? (
                        <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div
                          className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-body text-sm transition-colors duration-300 ${
                          isCompleted ? 'text-emerald-700' : 'text-foreground'
                        }`}>
                          {agent.name}
                        </p>
                        <p className={`font-body text-xs truncate transition-colors duration-300 ${
                          isCompleted ? 'text-emerald-600' : 'text-muted-foreground'
                        }`}>
                          {isCompleted ? 'Complete' : agent.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Note */}
            <div className="pt-4 border-t border-border">
              <p className="font-body text-xs text-muted-foreground text-center leading-relaxed">
                Nine specialized AI agents are evaluating your article for accuracy,
                bias, persuasion intent, and rhetorical techniques.
              </p>
            </div>
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
          <ArticleUploader
            onExtract={handleExtract}
            onConfirm={handleConfirm}
            initialUrl={initialUrl}
          />

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
                  Nine specialized AI agents evaluate evidence, logic, bias, persuasion intent, and manipulation.
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

// Main export wrapped in Suspense for useSearchParams
export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    }>
      <AnalyzePageContent />
    </Suspense>
  );
}

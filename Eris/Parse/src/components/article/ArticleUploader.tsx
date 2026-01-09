/**
 * ArticleUploader Component - The Newsroom
 * Handles URL input, article extraction, preview, and confirmation
 */

'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type { ExtractedArticle } from '@/types';

const LOADING_STAGES = [
  { progress: 15, label: 'Fetching article...' },
  { progress: 35, label: 'Parsing content...' },
  { progress: 55, label: 'Extracting claims...' },
  { progress: 75, label: 'Analyzing sources...' },
  { progress: 90, label: 'Finalizing...' },
];

interface ArticleUploaderProps {
  onExtract: (url: string) => Promise<any>;
  onConfirm: (article: ExtractedArticle, analysisType: 'free' | 'full') => void;
  initialUrl?: string;
}

export function ArticleUploader({ onExtract, onConfirm, initialUrl = '' }: ArticleUploaderProps) {
  const { data: session } = useSession();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedArticle, setExtractedArticle] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<'free' | 'full'>('full');
  const [loadingStage, setLoadingStage] = useState(0);
  const [progress, setProgress] = useState(0);

  // Update URL when initialUrl prop changes (for re-analyze)
  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

  // Animate progress bar through stages while loading
  useEffect(() => {
    if (!loading) {
      setLoadingStage(0);
      setProgress(0);
      return;
    }

    const stageInterval = setInterval(() => {
      setLoadingStage((prev) => {
        if (prev < LOADING_STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    return () => clearInterval(stageInterval);
  }, [loading]);

  // Smooth progress animation
  useEffect(() => {
    if (!loading) return;

    const targetProgress = LOADING_STAGES[loadingStage]?.progress || 0;
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < targetProgress) {
          return Math.min(prev + 2, targetProgress);
        }
        return prev;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, [loading, loadingStage]);

  const handleExtract = async () => {
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const article = await onExtract(url);
      setExtractedArticle(article);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract article');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (extractedArticle) {
      onConfirm(extractedArticle, selectedAnalysis);
    }
  };

  const handleReset = () => {
    setUrl('');
    setExtractedArticle(null);
    setError(null);
    setSelectedAnalysis('full');
  };

  return (
    <div className="space-y-8">
      {/* URL Input Stage */}
      {!extractedArticle && (
        <div className="card-editorial p-8">
          <div className="mb-6">
            <h2 className="font-headline text-2xl text-foreground mb-2">Article URL</h2>
            <p className="text-sm text-muted-foreground">
              Enter the URL of any news article, opinion piece, or analysis
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
              />
              <button
                onClick={handleExtract}
                disabled={loading || !url}
                className="btn-editorial-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                    Extracting...
                  </>
                ) : (
                  'Extract Article'
                )}
              </button>
            </div>

            {/* Progress Bar */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-byline">
                    {LOADING_STAGES[loadingStage]?.label || 'Processing...'}
                  </span>
                  <span className="text-sm text-muted-foreground font-byline">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 bg-muted/50 border border-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-150 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Stage */}
      {extractedArticle && (
        <div className="space-y-8">
          {/* Article Header */}
          <div className="card-editorial p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex-1">
                <span className="badge-section mb-3 inline-block">
                  {extractedArticle.articleType.replace('_', ' ')}
                </span>
                <h2 className="font-headline text-2xl md:text-3xl text-foreground mb-2">
                  {extractedArticle.title}
                </h2>
                <p className="dateline">
                  {extractedArticle.publication} • {new Date(extractedArticle.publishDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <a
                href={extractedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            </div>

            {/* Article Metrics - Miller's Law: 4 key metrics */}
            <div className="rule-double mb-6 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6">
                <div>
                  <div className="metric-label">Claims Found</div>
                  <div className="font-headline text-3xl text-foreground mt-1">{extractedArticle.claims.length}</div>
                </div>
                <div>
                  <div className="metric-label">Sources Cited</div>
                  <div className="font-headline text-3xl text-foreground mt-1">{extractedArticle.sources.length}</div>
                </div>
                <div>
                  <div className="metric-label">Statistics</div>
                  <div className="font-headline text-3xl text-foreground mt-1">{extractedArticle.statistics.length}</div>
                </div>
                <div>
                  <div className="metric-label">Emotional Density</div>
                  <div className="font-headline text-3xl text-foreground mt-1">
                    {Math.round(extractedArticle.emotionalLanguageDensity * 100)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Article Preview */}
            <div>
              <h3 className="font-section text-muted-foreground mb-4">Article Preview</h3>
              <div className="max-h-64 overflow-y-auto p-6 bg-muted/30 border border-border">
                <p className="font-headline text-xl text-foreground mb-3">{extractedArticle.content.headline}</p>
                {extractedArticle.content.subhead && (
                  <p className="font-deck text-muted-foreground mb-4">{extractedArticle.content.subhead}</p>
                )}
                <p className="font-body text-foreground mb-4 drop-cap">{extractedArticle.content.lede}</p>
                <p className="font-body text-muted-foreground line-clamp-4">
                  {extractedArticle.content.body.slice(0, 500)}...
                </p>
              </div>
            </div>
          </div>

          {/* Analysis Type Selection */}
          <div>
            <h3 className="font-section text-muted-foreground mb-6 text-center">Select Analysis Type</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Free Analysis */}
              <button
                onClick={() => setSelectedAnalysis('free')}
                className={`text-left card-editorial p-6 transition-all ${
                  selectedAnalysis === 'free'
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-headline text-xl text-foreground">Free Analysis</h4>
                  <span className="font-byline text-primary">FREE</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Quick truth score with steel-manned perspectives
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-foreground">
                    <span className="w-1.5 h-1.5 bg-primary" />
                    Truth Score (0-100)
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <span className="w-1.5 h-1.5 bg-primary" />
                    Steel-manned perspectives
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-1.5 h-1.5 bg-muted" />
                    1 free analysis per day
                  </li>
                </ul>
              </button>

              {/* Full Analysis */}
              <button
                onClick={() => setSelectedAnalysis('full')}
                className={`text-left card-editorial p-6 transition-all ${
                  selectedAnalysis === 'full'
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-headline text-xl text-foreground">Full Analysis</h4>
                  <span className="font-byline text-primary">20 CREDITS</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Complete deception detection and fact-checking
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-foreground">
                    <span className="w-1.5 h-1.5 bg-primary" />
                    Everything in Free, plus:
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <span className="w-1.5 h-1.5 bg-primary" />
                    Deception detection
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <span className="w-1.5 h-1.5 bg-primary" />
                    Logical fallacy identification
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <span className="w-1.5 h-1.5 bg-primary" />
                    Independent fact-checking
                  </li>
                </ul>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={handleReset} className="btn-editorial-outline flex-1 justify-center">
              Cancel
            </button>
            <button onClick={handleConfirm} className="btn-editorial-primary flex-1 justify-center flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Run {selectedAnalysis === 'free' ? 'Free' : 'Full'} Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

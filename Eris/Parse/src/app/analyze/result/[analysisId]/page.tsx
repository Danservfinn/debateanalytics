/**
 * Analysis Results Page
 * Displays full analysis results with truth score, steel-manned perspectives, deception detection, etc.
 * MVP: Reads from sessionStorage (no database)
 */

'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getCredibilityLabel, getCredibilityColor, type ParseAnalysis, type TruthScoreBreakdown, type SteelMannedPerspective, type DeceptionInstance } from "@/types";

interface PageProps {
  params: { analysisId: string };
}

export default function AnalysisResultPage({ params }: PageProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ParseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get analysis from sessionStorage
    const stored = sessionStorage.getItem(`analysis_${params.analysisId}`);
    if (stored) {
      try {
        setAnalysis(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored analysis:', e);
      }
    }
    setLoading(false);
  }, [params.analysisId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="font-headline text-2xl text-foreground">Analysis Not Found</h1>
          <p className="text-muted-foreground">
            The analysis may have expired or the link is invalid.
          </p>
          <Button onClick={() => router.push('/analyze')}>
            Analyze New Article
          </Button>
        </div>
      </div>
    );
  }

  const credibilityLabel = getCredibilityLabel(analysis.truthScore);
  const credibilityColor = getCredibilityColor(credibilityLabel);

  // Parse fields
  const scoreBreakdown: TruthScoreBreakdown = analysis.scoreBreakdown || {
    evidenceQuality: 0,
    methodologyRigor: 0,
    logicalStructure: 0,
    manipulationAbsence: 0,
  };

  const steelMannedPerspectives: SteelMannedPerspective[] = analysis.steelMannedPerspectives || [];
  const deceptions: DeceptionInstance[] = analysis.deceptionDetected || [];
  const fallacies = analysis.fallacies || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Truth Score Card */}
        <Card className="mb-8 border-border">
          <CardHeader>
            <CardTitle className="font-headline">Truth Score</CardTitle>
            <CardDescription>Assessment of {analysis.url}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div
                  className="text-7xl font-bold mb-2 font-masthead"
                  style={{ color: credibilityColor }}
                >
                  {analysis.truthScore}
                </div>
                <Badge
                  className="text-lg px-4 py-1"
                  style={{ backgroundColor: credibilityColor, color: 'white' }}
                >
                  {credibilityLabel.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {scoreBreakdown.evidenceQuality || 0}
                </div>
                <div className="text-sm text-muted-foreground">Evidence</div>
                <div className="text-xs text-muted-foreground">/40</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {scoreBreakdown.methodologyRigor || 0}
                </div>
                <div className="text-sm text-muted-foreground">Methodology</div>
                <div className="text-xs text-muted-foreground">/25</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {scoreBreakdown.logicalStructure || 0}
                </div>
                <div className="text-sm text-muted-foreground">Logic</div>
                <div className="text-xs text-muted-foreground">/20</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {scoreBreakdown.manipulationAbsence || 0}
                </div>
                <div className="text-sm text-muted-foreground">No Manipulation</div>
                <div className="text-xs text-muted-foreground">/15</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What AI Thinks */}
        {analysis.whatAiThinks && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline">What AI Thinks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed font-body text-foreground">{analysis.whatAiThinks}</p>
            </CardContent>
          </Card>
        )}

        {/* Steel-Manned Perspectives */}
        {steelMannedPerspectives.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline">Steel-Manned Perspectives</CardTitle>
              <CardDescription>
                Strongest possible versions of each viewpoint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {steelMannedPerspectives.map((perspective) => (
                  <div key={perspective.id} className="border border-border p-4 rounded-lg">
                    <h3 className="font-semibold mb-2 text-foreground">{perspective.label}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Quality Score: {perspective.steelMannedVersion.qualityScore}/100
                    </p>
                    <p className="text-sm text-foreground">{perspective.steelMannedVersion.coreClaim}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deception Detection */}
        {deceptions.length > 0 && (
          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="font-headline">Deception Detected</CardTitle>
              <CardDescription>
                Manipulation techniques and propaganda patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deceptions.map((deception) => (
                  <div key={deception.id} className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className="mb-1">{deception.type}</Badge>
                        <p className="text-sm italic text-foreground">"{deception.quote}"</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {deception.explanation}
                        </p>
                      </div>
                      <Badge
                        variant={
                          deception.severity === "high"
                            ? "destructive"
                            : deception.severity === "medium"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {deception.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Metadata */}
        <Card className="mb-8 border-border">
          <CardHeader>
            <CardTitle className="font-headline">Analysis Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Analyzed:</span>
                <span className="ml-2 text-foreground">{new Date(analysis.analyzedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <span className="ml-2 text-foreground">{analysis.analysisDuration.toFixed(1)}s</span>
              </div>
              <div>
                <span className="text-muted-foreground">Model:</span>
                <span className="ml-2 text-foreground">{analysis.modelVersion}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Agents Used:</span>
                <span className="ml-2 text-foreground">{analysis.agentsUsed?.length || 7}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-headline">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied!');
              }}>
                Copy Link
              </Button>
              <Button variant="outline" onClick={() => router.push('/analyze')}>
                Analyze Another Article
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

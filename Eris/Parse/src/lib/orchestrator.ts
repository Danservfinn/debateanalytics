/**
 * Analysis Orchestrator
 * Coordinates all analysis agents (MVP: no database dependency)
 */

import { extractArticle } from "@/agents/extraction-agent"
import { steelManArticle } from "@/agents/steel-manning-agent"
import { detectDeception } from "@/agents/deception-detection-agent"
import { factCheckArticle } from "@/agents/critical-fact-check-agent"
import { detectFallacies } from "@/agents/fallacy-agent"
import { auditContext } from "@/agents/context-audit-agent"
import { synthesizeAnalysis } from "@/agents/synthesis-agent"
import type { ParseAnalysis } from "@/types"

/**
 * Run full analysis on an article (MVP: in-memory only, no database)
 */
export async function runFullAnalysis(articleUrl: string, userId: string): Promise<ParseAnalysis> {
  const startTime = Date.now()
  const articleId = crypto.randomUUID()

  try {
    // Step 1: Extract article
    const article = await extractArticle({ url: articleUrl })

    // Step 2: Run all 5 agents in parallel (for speed)
    const [
      steelMannedPerspectives,
      deceptionResult,
      factCheckResults,
      fallacies,
      contextAudit,
    ] = await Promise.all([
      steelManArticle({ article }),
      detectDeception({ article }),
      factCheckArticle({ article }),
      detectFallacies({ article }),
      auditContext({ article }),
    ])

    // Step 3: Synthesize results
    const synthesis = await synthesizeAnalysis({
      article,
      steelMannedPerspectives,
      deceptionDetected: deceptionResult.instances,
      factCheckResults,
      fallacies,
      contextAudit,
    })

    // Step 4: Build final analysis
    const analysis: ParseAnalysis = {
      id: crypto.randomUUID(),
      articleId,
      analyzedAt: new Date().toISOString(),
      url: articleUrl,
      truthScore: synthesis.truthScore,
      credibility: synthesis.credibility,
      scoreBreakdown: synthesis.breakdown,
      steelMannedPerspectives,
      manipulationRisk: {
        overallRisk: deceptionResult.overallRisk,
        score: deceptionResult.score,
        breakdown: {
          emotional: 0, // TODO: Calculate from instances
          framing: 0,
          omission: contextAudit.overallScore,
          source: 0,
          propaganda: 0,
        },
        severityDistribution: {
          high: deceptionResult.instances.filter(i => i.severity === 'high').length,
          medium: deceptionResult.instances.filter(i => i.severity === 'medium').length,
          low: deceptionResult.instances.filter(i => i.severity === 'low').length,
        },
      },
      deceptionDetected: deceptionResult.instances,
      fallacies,
      factCheckResults,
      whatAiThinks: synthesis.whatAiThinks,
      analysisDuration: (Date.now() - startTime) / 1000,
      agentsUsed: [
        'ExtractionAgent',
        'SteelManningAgent',
        'DeceptionDetectionAgent',
        'CriticalFactCheckAgent',
        'FallacyAgent',
        'ContextAuditAgent',
        'SynthesisAgent',
      ],
      modelVersion: 'glm-4.7',
    }

    return analysis
  } catch (error) {
    console.error('Analysis failed:', error)
    throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Run free analysis (limited version)
 */
export async function runFreeAnalysis(articleUrl: string, userId: string): Promise<ParseAnalysis> {
  // For MVP, free analysis = full analysis
  // In production, limit to basic truth score without detailed perspectives
  return runFullAnalysis(articleUrl, userId)
}

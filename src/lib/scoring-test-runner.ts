/**
 * Traditional Scoring Test Runner
 *
 * Provides utilities to test the traditional debate scoring system
 * against sample fixtures and compare with legacy scoring.
 */

import type {
  FlowAnalysisRequest,
  FlowAnalysisResult,
  TraditionalDebateVerdict,
  TraditionalScoringConfig,
  FlowComment
} from '@/types/debate-scoring'
import { DEFAULT_SCORING_CONFIG } from '@/types/debate-scoring'
import { runFlowAnalysis, calculateTraditionalVerdict } from './traditional-scoring'
import {
  SIMPLE_DEBATE_FIXTURE,
  PRO_DOMINANT_FIXTURE,
  DRAW_FIXTURE,
  STRICT_CONFIG,
  LENIENT_CONFIG,
  IMPACT_FOCUSED_CONFIG,
  extractCalibrationMetrics,
  formatMetricsLog,
  suggestThresholdAdjustments,
  compareWithLegacy,
  recommendConfig,
  type CalibrationMetrics,
  type ScoringComparison
} from './scoring-calibration'

// =============================================================================
// TEST RESULT TYPES
// =============================================================================

export interface TestResult {
  name: string
  fixture: string
  config: string
  success: boolean
  error?: string

  // Results
  flowResult?: FlowAnalysisResult
  verdict?: TraditionalDebateVerdict
  metrics?: CalibrationMetrics
  comparison?: ScoringComparison

  // Expectations
  expectedWinner?: 'pro' | 'con' | 'draw'
  winnerMatched?: boolean

  // Performance
  durationMs: number
}

export interface TestSuite {
  name: string
  tests: TestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    winnerAccuracy: number
    averageDuration: number
  }
}

// =============================================================================
// TEST EXECUTION
// =============================================================================

/**
 * Run a single test with fixture and configuration
 */
export async function runSingleTest(
  name: string,
  fixture: FlowComment[],
  centralQuestion: string,
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG,
  expectedWinner?: 'pro' | 'con' | 'draw',
  legacyProScore?: number,
  legacyConScore?: number
): Promise<TestResult> {
  const startTime = Date.now()

  const request: FlowAnalysisRequest = {
    comments: fixture,
    centralQuestion,
    threadTitle: name,
    positionDefinitions: {
      proDefinition: 'Supports the proposition',
      conDefinition: 'Opposes the proposition'
    }
  }

  try {
    // Run flow analysis
    console.log(`[Test] Running: ${name}`)
    const flowResult = await runFlowAnalysis(request)

    // Calculate verdict
    const verdict = await calculateTraditionalVerdict(
      request,
      flowResult.arguments,
      flowResult.clashes,
      flowResult.issues,
      config
    )

    const durationMs = Date.now() - startTime

    // Extract metrics
    const metrics = extractCalibrationMetrics(flowResult, verdict, durationMs)

    // Compare with legacy if available
    const comparison = compareWithLegacy(verdict, legacyProScore, legacyConScore)

    // Check if winner matches expectation
    const winnerMatched = expectedWinner === undefined || verdict.winner === expectedWinner

    console.log(`[Test] ${name}: ${verdict.winner.toUpperCase()} wins (${winnerMatched ? 'PASS' : 'FAIL'})`)

    return {
      name,
      fixture: `${fixture.length} comments`,
      config: getConfigName(config),
      success: true,
      flowResult,
      verdict,
      metrics,
      comparison,
      expectedWinner,
      winnerMatched,
      durationMs
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error(`[Test] ${name} FAILED:`, error)

    return {
      name,
      fixture: `${fixture.length} comments`,
      config: getConfigName(config),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs
    }
  }
}

/**
 * Run all standard test fixtures
 */
export async function runStandardTests(
  config: TraditionalScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<TestSuite> {
  const tests: TestResult[] = []

  // Test 1: Simple balanced debate
  tests.push(await runSingleTest(
    'Simple Balanced Debate',
    SIMPLE_DEBATE_FIXTURE,
    'Is renewable energy cost-effective at scale?',
    config,
    undefined // No expected winner - let's see what happens
  ))

  // Test 2: PRO dominant debate
  tests.push(await runSingleTest(
    'PRO Dominant Debate',
    PRO_DOMINANT_FIXTURE,
    'Does remote work increase productivity?',
    config,
    'pro' // Expected: PRO should win
  ))

  // Test 3: Draw debate
  tests.push(await runSingleTest(
    'Even Draw Debate',
    DRAW_FIXTURE,
    'Should we invest in nuclear energy?',
    config,
    'draw' // Expected: Should be close to draw
  ))

  // Calculate summary
  const passed = tests.filter(t => t.success && t.winnerMatched !== false).length
  const failed = tests.filter(t => !t.success || t.winnerMatched === false).length
  const winnerTests = tests.filter(t => t.expectedWinner !== undefined)
  const winnerAccuracy = winnerTests.length > 0
    ? winnerTests.filter(t => t.winnerMatched).length / winnerTests.length
    : 1

  const totalDuration = tests.reduce((sum, t) => sum + t.durationMs, 0)

  return {
    name: 'Standard Test Suite',
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
      winnerAccuracy,
      averageDuration: totalDuration / tests.length
    }
  }
}

/**
 * Run configuration comparison tests
 */
export async function runConfigComparison(
  fixture: FlowComment[],
  centralQuestion: string,
  expectedWinner?: 'pro' | 'con' | 'draw'
): Promise<{
  configs: Array<{
    name: string
    verdict: TraditionalDebateVerdict | null
    metrics: CalibrationMetrics | null
    suggestions: string[]
  }>
  recommendation: {
    name: string
    reasoning: string
  }
}> {
  const configs = [
    { name: 'Default', config: DEFAULT_SCORING_CONFIG },
    { name: 'Strict', config: STRICT_CONFIG },
    { name: 'Lenient', config: LENIENT_CONFIG },
    { name: 'Impact-Focused', config: IMPACT_FOCUSED_CONFIG }
  ]

  const results: Array<{
    name: string
    verdict: TraditionalDebateVerdict | null
    metrics: CalibrationMetrics | null
    suggestions: string[]
  }> = []

  for (const { name, config } of configs) {
    console.log(`[Config Comparison] Testing ${name} configuration...`)

    const result = await runSingleTest(
      `${centralQuestion} (${name})`,
      fixture,
      centralQuestion,
      config,
      expectedWinner
    )

    results.push({
      name,
      verdict: result.verdict || null,
      metrics: result.metrics || null,
      suggestions: result.metrics
        ? suggestThresholdAdjustments(result.metrics, config)
        : []
    })
  }

  // Get recommendation
  const avgLength = fixture.reduce((sum, c) => sum + c.text.length, 0) / fixture.length
  const hasEvidence = fixture.some(c =>
    /study|research|data|statistic|according to|source/i.test(c.text)
  )

  const recommendation = recommendConfig(fixture.length, avgLength, hasEvidence)

  return {
    configs: results,
    recommendation: {
      name: recommendation.name,
      reasoning: recommendation.reasoning
    }
  }
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Generate a detailed test report
 */
export function generateTestReport(suite: TestSuite): string {
  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`              ${suite.name.toUpperCase()}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(`Total Tests: ${suite.summary.total}`)
  lines.push(`Passed: ${suite.summary.passed}`)
  lines.push(`Failed: ${suite.summary.failed}`)
  lines.push(`Winner Accuracy: ${(suite.summary.winnerAccuracy * 100).toFixed(0)}%`)
  lines.push(`Average Duration: ${suite.summary.averageDuration.toFixed(0)}ms`)
  lines.push('')
  lines.push('───────────────────────────────────────────────────────────────')

  for (const test of suite.tests) {
    lines.push('')
    lines.push(`TEST: ${test.name}`)
    lines.push(`  Fixture: ${test.fixture}`)
    lines.push(`  Config: ${test.config}`)
    lines.push(`  Status: ${test.success ? 'SUCCESS' : 'FAILED'}`)

    if (test.error) {
      lines.push(`  Error: ${test.error}`)
    }

    if (test.verdict) {
      lines.push(`  Winner: ${test.verdict.winner.toUpperCase()} (${test.verdict.winnerConfidence}% confidence)`)
      lines.push(`  Score: PRO ${test.verdict.proScore} - CON ${test.verdict.conScore}`)

      if (test.expectedWinner) {
        lines.push(`  Expected: ${test.expectedWinner.toUpperCase()}`)
        lines.push(`  Match: ${test.winnerMatched ? 'YES' : 'NO'}`)
      }
    }

    if (test.metrics) {
      lines.push(`  Arguments: ${test.metrics.totalArguments} (PRO: ${test.metrics.proArguments}, CON: ${test.metrics.conArguments})`)
      lines.push(`  Issues: ${test.metrics.totalIssues} (PRO: ${test.metrics.proIssueWins}, CON: ${test.metrics.conIssueWins}, Draw: ${test.metrics.issueDraws})`)
      lines.push(`  Clashes: ${test.metrics.totalClashes} (Avg Quality: ${test.metrics.averageClashQuality.toFixed(1)}/10)`)
    }

    if (test.comparison && test.comparison.insights.length > 0) {
      lines.push('  Insights:')
      for (const insight of test.comparison.insights) {
        lines.push(`    - ${insight}`)
      }
    }

    lines.push(`  Duration: ${test.durationMs}ms`)
    lines.push('───────────────────────────────────────────────────────────────')
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

/**
 * Generate config comparison report
 */
export function generateConfigComparisonReport(
  comparison: Awaited<ReturnType<typeof runConfigComparison>>
): string {
  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('              CONFIGURATION COMPARISON')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(`Recommended Config: ${comparison.recommendation.name}`)
  lines.push(`Reasoning: ${comparison.recommendation.reasoning}`)
  lines.push('')
  lines.push('───────────────────────────────────────────────────────────────')

  for (const config of comparison.configs) {
    lines.push('')
    lines.push(`CONFIG: ${config.name}`)

    if (config.verdict) {
      lines.push(`  Winner: ${config.verdict.winner.toUpperCase()} (${config.verdict.winnerConfidence}% confidence)`)
      lines.push(`  Score: PRO ${config.verdict.proScore} - CON ${config.verdict.conScore}`)
    } else {
      lines.push('  (No verdict)')
    }

    if (config.metrics) {
      lines.push(`  Issues: PRO ${config.metrics.proIssueWins}, CON ${config.metrics.conIssueWins}, Draw ${config.metrics.issueDraws}`)
    }

    if (config.suggestions.length > 0) {
      lines.push('  Suggestions:')
      for (const suggestion of config.suggestions) {
        lines.push(`    - ${suggestion}`)
      }
    }

    lines.push('───────────────────────────────────────────────────────────────')
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

// =============================================================================
// HELPERS
// =============================================================================

function getConfigName(config: TraditionalScoringConfig): string {
  if (config === DEFAULT_SCORING_CONFIG) return 'Default'
  if (config === STRICT_CONFIG) return 'Strict'
  if (config === LENIENT_CONFIG) return 'Lenient'
  if (config === IMPACT_FOCUSED_CONFIG) return 'Impact-Focused'
  return 'Custom'
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  runSingleTest,
  runStandardTests,
  runConfigComparison,
  generateTestReport,
  generateConfigComparisonReport
}

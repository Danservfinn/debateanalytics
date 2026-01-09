/**
 * Test script to run full analysis and save output
 * Usage: npx tsx test-outputs/run-analysis.ts [URL]
 */

import { runFullAnalysis } from "../src/lib/orchestrator"
import { writeFileSync } from "fs"

// Default test article - Breaking News: ICE shooting in Minneapolis
const DEFAULT_URL = "https://www.wral.com/news/ap/842b1-what-to-know-about-the-fatal-shooting-of-a-woman-by-an-ice-officer-in-minneapolis/"

// Allow URL to be passed as command line argument
const TEST_URL = process.argv[2] || DEFAULT_URL

async function main() {
  console.log("Starting Parse analysis...")
  console.log(`URL: ${TEST_URL}`)
  console.log("---")

  const startTime = Date.now()

  try {
    const result = await runFullAnalysis(TEST_URL, "test-user")

    const duration = (Date.now() - startTime) / 1000
    console.log(`Analysis completed in ${duration}s`)

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `test-outputs/analysis-${timestamp}.json`
    writeFileSync(filename, JSON.stringify(result, null, 2))
    console.log(`Saved to: ${filename}`)

    // Print summary
    console.log("\n=== ANALYSIS SUMMARY ===")
    console.log(`Title: ${result.articleMetadata?.title || "N/A"}`)
    console.log(`Publication: ${result.articleMetadata?.publication || "N/A"}`)
    console.log(`Claims Extracted: ${result.extractedClaims?.length || 0}`)
    console.log(`Sources Cited: ${result.sourcesCited?.length || 0}`)
    console.log(`Steel-Manned Perspectives: ${result.steelMannedPerspectives?.length || 0}`)
    console.log(`Deception Instances: ${result.deceptionDetected?.length || 0}`)
    console.log(`Fallacies: ${result.fallacies?.length || 0}`)
    console.log(`Fact-Check Results: ${result.factCheckResults?.length || 0}`)
    console.log("\n=== SCORES ===")
    console.log(`Truth Score: ${result.truthScore}/100`)
    console.log(`Factual Reliability: ${result.dualScores?.factualReliability?.score || "N/A"}/100`)
    console.log(`Rhetorical Neutrality: ${result.dualScores?.rhetoricalNeutrality?.score || "N/A"}/100`)
    console.log(`Breaking News: ${result.breakingNewsContext?.isBreakingNews ? "YES" : "NO"}`)

    return result
  } catch (error) {
    console.error("Analysis failed:", error)
    throw error
  }
}

main().catch(console.error)

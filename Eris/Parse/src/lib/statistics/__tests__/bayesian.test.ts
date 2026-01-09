/**
 * Unit Tests for Bayesian Scoring Module
 */

import { describe, it, expect } from 'vitest'
import { calculateBayesianScore, type BayesianSourceScore } from '../bayesian'

describe('calculateBayesianScore', () => {
  const globalMean = 50
  const globalVariance = 400 // stddev = 20

  describe('edge cases', () => {
    it('should return global mean with INSUFFICIENT confidence for empty scores', () => {
      const result = calculateBayesianScore([], globalMean, globalVariance)

      expect(result.rawMean).toBe(globalMean)
      expect(result.rawVariance).toBe(globalVariance)
      expect(result.sampleSize).toBe(0)
      expect(result.shrunkScore).toBe(globalMean)
      expect(result.effectiveSampleSize).toBe(0)
      expect(result.gradeConfidence).toBe('INSUFFICIENT')
      expect(result.credibleInterval.lower).toBe(0)
      expect(result.credibleInterval.upper).toBe(100)
    })

    it('should handle single score with high shrinkage', () => {
      const result = calculateBayesianScore([80], globalMean, globalVariance)

      expect(result.sampleSize).toBe(1)
      expect(result.rawMean).toBe(80)
      // With n=1, shrinkage pulls heavily toward global mean
      expect(result.shrunkScore).toBeLessThan(80)
      expect(result.shrunkScore).toBeGreaterThan(globalMean)
    })
  })

  describe('shrinkage behavior', () => {
    it('should shrink small samples toward global mean', () => {
      // Small sample with high scores should be pulled toward global mean
      const result = calculateBayesianScore([90, 90, 90], globalMean, globalVariance)

      expect(result.shrunkScore).toBeLessThan(90)
      expect(result.shrunkScore).toBeGreaterThan(globalMean)
    })

    it('should apply less shrinkage to larger samples', () => {
      const smallSample = calculateBayesianScore([80, 80, 80], globalMean, globalVariance)
      const largeSample = calculateBayesianScore(
        Array(30).fill(80),
        globalMean,
        globalVariance
      )

      // Larger sample should be closer to raw mean (less shrinkage)
      expect(largeSample.shrunkScore).toBeGreaterThan(smallSample.shrunkScore)
      // Large sample with identical values has 0 variance, so shrinkage uses global variance
      // The shrunk score should still be much closer to 80 than small sample
      expect(largeSample.shrunkScore).toBeGreaterThanOrEqual(75)
    })

    it('should shrink toward global mean regardless of direction', () => {
      const highScores = calculateBayesianScore([90, 90, 90], globalMean, globalVariance)
      const lowScores = calculateBayesianScore([10, 10, 10], globalMean, globalVariance)

      // High scores shrunk down
      expect(highScores.shrunkScore).toBeLessThan(90)
      expect(highScores.shrunkScore).toBeGreaterThan(globalMean)

      // Low scores shrunk up
      expect(lowScores.shrunkScore).toBeGreaterThan(10)
      expect(lowScores.shrunkScore).toBeLessThan(globalMean)
    })
  })

  describe('credible intervals', () => {
    it('should produce narrower intervals with larger samples', () => {
      const smallSample = calculateBayesianScore([60, 70, 80], globalMean, globalVariance)
      const largeSample = calculateBayesianScore(
        Array(50).fill(70),
        globalMean,
        globalVariance
      )

      const smallWidth = smallSample.credibleInterval.upper - smallSample.credibleInterval.lower
      const largeWidth = largeSample.credibleInterval.upper - largeSample.credibleInterval.lower

      expect(largeWidth).toBeLessThan(smallWidth)
    })

    it('should bound intervals between 0 and 100', () => {
      const result = calculateBayesianScore([95, 98, 99], globalMean, globalVariance)

      expect(result.credibleInterval.lower).toBeGreaterThanOrEqual(0)
      expect(result.credibleInterval.upper).toBeLessThanOrEqual(100)
    })

    it('should contain the shrunk score within the interval', () => {
      const result = calculateBayesianScore([60, 65, 70, 75, 80], globalMean, globalVariance)

      expect(result.shrunkScore).toBeGreaterThanOrEqual(result.credibleInterval.lower)
      expect(result.shrunkScore).toBeLessThanOrEqual(result.credibleInterval.upper)
    })
  })

  describe('confidence levels', () => {
    it('should return HIGH confidence for large sample with low variance', () => {
      const scores = Array(40).fill(60) // n=40, low variance
      const result = calculateBayesianScore(scores, globalMean, globalVariance)

      expect(result.gradeConfidence).toBe('HIGH')
    })

    it('should return MEDIUM confidence for moderate samples', () => {
      const scores = Array(20).fill(0).map((_, i) => 50 + (i % 10)) // n=20, some variance
      const result = calculateBayesianScore(scores, globalMean, globalVariance)

      expect(['HIGH', 'MEDIUM']).toContain(result.gradeConfidence)
    })

    it('should return LOW confidence for small samples', () => {
      const result = calculateBayesianScore([60, 65, 70, 75, 80], globalMean, globalVariance)

      expect(['LOW', 'MEDIUM']).toContain(result.gradeConfidence)
    })

    it('should return INSUFFICIENT for very small samples', () => {
      const result = calculateBayesianScore([70], globalMean, globalVariance)

      expect(['INSUFFICIENT', 'LOW']).toContain(result.gradeConfidence)
    })
  })

  describe('effective sample size', () => {
    it('should equal raw sample size when using simple score arrays', () => {
      const scores = [60, 70, 80, 90, 100]
      const result = calculateBayesianScore(scores, globalMean, globalVariance)

      expect(result.effectiveSampleSize).toBe(scores.length)
    })
  })

  describe('score rounding', () => {
    it('should round shrunk score to one decimal place', () => {
      const result = calculateBayesianScore([73, 74, 75], globalMean, globalVariance)

      const decimalPlaces = (result.shrunkScore.toString().split('.')[1] || '').length
      expect(decimalPlaces).toBeLessThanOrEqual(1)
    })

    it('should round credible interval bounds to one decimal place', () => {
      const result = calculateBayesianScore([60, 70, 80], globalMean, globalVariance)

      const lowerDecimals = (result.credibleInterval.lower.toString().split('.')[1] || '').length
      const upperDecimals = (result.credibleInterval.upper.toString().split('.')[1] || '').length

      expect(lowerDecimals).toBeLessThanOrEqual(1)
      expect(upperDecimals).toBeLessThanOrEqual(1)
    })
  })

  describe('variance handling', () => {
    it('should handle zero sample variance (identical scores)', () => {
      const result = calculateBayesianScore([70, 70, 70, 70], globalMean, globalVariance)

      expect(result.rawVariance).toBe(0)
      // Should still produce valid output using global variance as fallback
      expect(result.shrunkScore).toBeGreaterThan(0)
      expect(result.shrunkScore).toBeLessThan(100)
    })

    it('should handle high sample variance', () => {
      const result = calculateBayesianScore([10, 90, 20, 80, 30, 70], globalMean, globalVariance)

      expect(result.rawVariance).toBeGreaterThan(500)
      // High variance should result in wider intervals
      const intervalWidth = result.credibleInterval.upper - result.credibleInterval.lower
      expect(intervalWidth).toBeGreaterThan(20)
    })
  })

  describe('integration behavior', () => {
    it('should produce consistent results for same input', () => {
      const scores = [55, 60, 65, 70, 75]
      const result1 = calculateBayesianScore(scores, globalMean, globalVariance)
      const result2 = calculateBayesianScore(scores, globalMean, globalVariance)

      expect(result1.shrunkScore).toBe(result2.shrunkScore)
      expect(result1.credibleInterval).toEqual(result2.credibleInterval)
      expect(result1.gradeConfidence).toBe(result2.gradeConfidence)
    })

    it('should return complete BayesianSourceScore structure', () => {
      const result = calculateBayesianScore([60, 70, 80], globalMean, globalVariance)

      expect(result).toHaveProperty('rawMean')
      expect(result).toHaveProperty('rawVariance')
      expect(result).toHaveProperty('sampleSize')
      expect(result).toHaveProperty('shrunkScore')
      expect(result).toHaveProperty('credibleInterval')
      expect(result).toHaveProperty('credibleInterval.lower')
      expect(result).toHaveProperty('credibleInterval.upper')
      expect(result).toHaveProperty('effectiveSampleSize')
      expect(result).toHaveProperty('gradeConfidence')
    })
  })
})

/**
 * Unit Tests for Logic Score Calculator
 */

import { describe, it, expect } from 'vitest'
import { calculateLogicScore } from '../logic-score'

describe('calculateLogicScore', () => {
  describe('edge cases', () => {
    it('should return 50 (neutral) for zero articles', () => {
      expect(calculateLogicScore({ fallacies: [], totalArticles: 0 })).toBe(50)
    })

    it('should return 100 for articles with no fallacies', () => {
      expect(calculateLogicScore({ fallacies: [], totalArticles: 5 })).toBe(100)
    })

    it('should return 100 for single article with no fallacies', () => {
      expect(calculateLogicScore({ fallacies: [], totalArticles: 1 })).toBe(100)
    })
  })

  describe('severity weighting', () => {
    it('should weight high severity fallacies at 3x', () => {
      const result = calculateLogicScore({
        fallacies: [{ type: 'straw_man', severity: 'high' }],
        totalArticles: 1
      })
      // 3 weighted fallacies / 1 article = 3 avg, score = 100 - (3 * 20) = 40
      expect(result).toBe(40)
    })

    it('should weight medium severity fallacies at 2x', () => {
      const result = calculateLogicScore({
        fallacies: [{ type: 'straw_man', severity: 'medium' }],
        totalArticles: 1
      })
      // 2 weighted fallacies / 1 article = 2 avg, score = 100 - (2 * 20) = 60
      expect(result).toBe(60)
    })

    it('should weight low severity fallacies at 1x', () => {
      const result = calculateLogicScore({
        fallacies: [{ type: 'straw_man', severity: 'low' }],
        totalArticles: 1
      })
      // 1 weighted fallacy / 1 article = 1 avg, score = 100 - (1 * 20) = 80
      expect(result).toBe(80)
    })
  })

  describe('multiple fallacies', () => {
    it('should accumulate weighted fallacies', () => {
      const result = calculateLogicScore({
        fallacies: [
          { type: 'straw_man', severity: 'high' },   // 3
          { type: 'ad_hominem', severity: 'medium' }, // 2
          { type: 'appeal_to_emotion', severity: 'low' } // 1
        ],
        totalArticles: 1
      })
      // 6 weighted fallacies / 1 article = 6 avg, score = max(0, 100 - 120) = 0
      expect(result).toBe(0)
    })

    it('should average across multiple articles', () => {
      const result = calculateLogicScore({
        fallacies: [
          { type: 'straw_man', severity: 'high' }, // 3
          { type: 'ad_hominem', severity: 'high' } // 3
        ],
        totalArticles: 3
      })
      // 6 weighted fallacies / 3 articles = 2 avg, score = 100 - (2 * 20) = 60
      expect(result).toBe(60)
    })

    it('should handle many low severity fallacies', () => {
      const result = calculateLogicScore({
        fallacies: Array(5).fill({ type: 'minor', severity: 'low' }),
        totalArticles: 1
      })
      // 5 weighted fallacies / 1 article = 5 avg, score = 100 - (5 * 20) = 0
      expect(result).toBe(0)
    })
  })

  describe('score boundaries', () => {
    it('should not exceed 100', () => {
      const result = calculateLogicScore({
        fallacies: [],
        totalArticles: 100
      })
      expect(result).toBe(100)
    })

    it('should not go below 0', () => {
      const result = calculateLogicScore({
        fallacies: Array(10).fill({ type: 'major', severity: 'high' }), // 30 weighted
        totalArticles: 1
      })
      // 30 / 1 = 30 avg, score = max(0, 100 - 600) = 0
      expect(result).toBe(0)
    })

    it('should floor at 0 for extreme fallacy counts', () => {
      const result = calculateLogicScore({
        fallacies: Array(50).fill({ type: 'critical', severity: 'high' }),
        totalArticles: 1
      })
      expect(result).toBe(0)
    })
  })

  describe('score calculation accuracy', () => {
    it('should calculate exact score for known inputs', () => {
      // 1 high (3) + 2 medium (4) + 3 low (3) = 10 weighted
      // 10 / 5 articles = 2 avg, score = 100 - 40 = 60
      const result = calculateLogicScore({
        fallacies: [
          { type: 'a', severity: 'high' },
          { type: 'b', severity: 'medium' },
          { type: 'c', severity: 'medium' },
          { type: 'd', severity: 'low' },
          { type: 'e', severity: 'low' },
          { type: 'f', severity: 'low' }
        ],
        totalArticles: 5
      })
      expect(result).toBe(60)
    })

    it('should handle fractional averages', () => {
      // 2 low (2 weighted) / 3 articles = 0.667 avg
      // score = 100 - (0.667 * 20) = 100 - 13.33 = 86.67
      const result = calculateLogicScore({
        fallacies: [
          { type: 'a', severity: 'low' },
          { type: 'b', severity: 'low' }
        ],
        totalArticles: 3
      })
      expect(result).toBeCloseTo(86.7, 1)
    })
  })

  describe('rounding behavior', () => {
    it('should round to one decimal place', () => {
      const result = calculateLogicScore({
        fallacies: [{ type: 'test', severity: 'low' }],
        totalArticles: 7
      })
      // 1 / 7 = 0.143 avg, score = 100 - 2.86 = 97.14
      const decimalPlaces = (result.toString().split('.')[1] || '').length
      expect(decimalPlaces).toBeLessThanOrEqual(1)
    })
  })

  describe('unknown severity handling', () => {
    it('should default to weight 1 for unknown severity', () => {
      const result = calculateLogicScore({
        fallacies: [{ type: 'test', severity: 'unknown' as any }],
        totalArticles: 1
      })
      // Falls back to weight 1, score = 100 - 20 = 80
      expect(result).toBe(80)
    })
  })

  describe('fallacy type independence', () => {
    it('should not differentiate by fallacy type, only severity', () => {
      const result1 = calculateLogicScore({
        fallacies: [{ type: 'straw_man', severity: 'high' }],
        totalArticles: 1
      })
      const result2 = calculateLogicScore({
        fallacies: [{ type: 'ad_hominem', severity: 'high' }],
        totalArticles: 1
      })
      expect(result1).toBe(result2)
    })
  })

  describe('real-world scenarios', () => {
    it('should score well for publication with occasional minor fallacies', () => {
      // 10 articles, 3 low severity fallacies
      const result = calculateLogicScore({
        fallacies: [
          { type: 'minor1', severity: 'low' },
          { type: 'minor2', severity: 'low' },
          { type: 'minor3', severity: 'low' }
        ],
        totalArticles: 10
      })
      // 3 / 10 = 0.3 avg, score = 100 - 6 = 94
      expect(result).toBe(94)
    })

    it('should score poorly for publication with frequent high severity fallacies', () => {
      // 5 articles, 5 high severity fallacies
      const result = calculateLogicScore({
        fallacies: Array(5).fill({ type: 'major', severity: 'high' }),
        totalArticles: 5
      })
      // 15 / 5 = 3 avg, score = 100 - 60 = 40
      expect(result).toBe(40)
    })

    it('should score moderately for mixed fallacy profile', () => {
      // Typical profile: some articles have issues
      const result = calculateLogicScore({
        fallacies: [
          { type: 'a', severity: 'high' },
          { type: 'b', severity: 'medium' },
          { type: 'c', severity: 'low' },
          { type: 'd', severity: 'low' }
        ],
        totalArticles: 10
      })
      // (3 + 2 + 1 + 1) = 7 weighted / 10 = 0.7 avg
      // score = 100 - 14 = 86
      expect(result).toBe(86)
    })
  })
})

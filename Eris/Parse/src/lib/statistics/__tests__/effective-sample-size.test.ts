/**
 * Unit Tests for Effective Sample Size Calculator
 */

import { describe, it, expect } from 'vitest'
import {
  calculateEffectiveSampleSize,
  calculateEffectiveSampleSizeWithDates
} from '../effective-sample-size'

describe('calculateEffectiveSampleSize', () => {
  describe('basic behavior', () => {
    it('should return 0 for empty array', () => {
      expect(calculateEffectiveSampleSize([])).toBe(0)
    })

    it('should return 1 for single element', () => {
      expect(calculateEffectiveSampleSize([50])).toBe(1)
    })

    it('should return count for multiple elements', () => {
      expect(calculateEffectiveSampleSize([1, 2, 3, 4, 5])).toBe(5)
    })

    it('should return exact count regardless of score values', () => {
      expect(calculateEffectiveSampleSize([100, 100, 100])).toBe(3)
      expect(calculateEffectiveSampleSize([0, 0, 0])).toBe(3)
      expect(calculateEffectiveSampleSize([10, 50, 90])).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('should handle large arrays', () => {
      const largeArray = Array(1000).fill(50)
      expect(calculateEffectiveSampleSize(largeArray)).toBe(1000)
    })

    it('should handle negative values', () => {
      expect(calculateEffectiveSampleSize([-10, -20, -30])).toBe(3)
    })

    it('should handle decimal values', () => {
      expect(calculateEffectiveSampleSize([1.5, 2.5, 3.5])).toBe(3)
    })
  })
})

describe('calculateEffectiveSampleSizeWithDates', () => {
  describe('basic behavior', () => {
    it('should return 0 for empty array', () => {
      expect(calculateEffectiveSampleSizeWithDates([])).toBe(0)
    })

    it('should return 1 for single analysis', () => {
      const analyses = [{ createdAt: '2026-01-01', truthScore: 70 }]
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBe(1)
    })
  })

  describe('temporal weighting', () => {
    it('should give 30% independence for same-day submissions', () => {
      const analyses = [
        { createdAt: '2026-01-01T10:00:00Z', truthScore: 70 },
        { createdAt: '2026-01-01T14:00:00Z', truthScore: 75 }
      ]
      // 1 + 0.3 = 1.3
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(1.3, 1)
    })

    it('should give 60% independence for same-week submissions', () => {
      const analyses = [
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: '2026-01-03', truthScore: 75 } // 2 days apart
      ]
      // 1 + 0.6 = 1.6
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(1.6, 1)
    })

    it('should give 85% independence for same-month submissions', () => {
      const analyses = [
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: '2026-01-15', truthScore: 75 } // 14 days apart
      ]
      // 1 + 0.85 = 1.85
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(1.9, 1)
    })

    it('should give 100% independence for different-month submissions', () => {
      const analyses = [
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: '2026-03-01', truthScore: 75 } // 59 days apart
      ]
      // 1 + 1.0 = 2.0
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBe(2)
    })
  })

  describe('multiple analyses', () => {
    it('should accumulate weights for multiple submissions', () => {
      const analyses = [
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: '2026-01-02', truthScore: 72 }, // 1 day = 0.6
        { createdAt: '2026-01-10', truthScore: 75 }, // 8 days = 0.85
        { createdAt: '2026-02-15', truthScore: 78 }  // 36 days = 1.0
      ]
      // 1 + 0.6 + 0.85 + 1.0 = 3.45
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(3.5, 1)
    })

    it('should handle unsorted input by sorting internally', () => {
      const analyses = [
        { createdAt: '2026-02-15', truthScore: 78 },
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: '2026-01-10', truthScore: 75 },
        { createdAt: '2026-01-02', truthScore: 72 }
      ]
      // Same result regardless of input order
      // 1 + 0.6 + 0.85 + 1.0 = 3.45
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(3.5, 1)
    })

    it('should handle burst submissions (all same day)', () => {
      const analyses = [
        { createdAt: '2026-01-01T09:00:00Z', truthScore: 70 },
        { createdAt: '2026-01-01T10:00:00Z', truthScore: 72 },
        { createdAt: '2026-01-01T11:00:00Z', truthScore: 75 },
        { createdAt: '2026-01-01T12:00:00Z', truthScore: 78 },
        { createdAt: '2026-01-01T13:00:00Z', truthScore: 80 }
      ]
      // 1 + 0.3 + 0.3 + 0.3 + 0.3 = 2.2
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(2.2, 1)
    })

    it('should handle well-spaced submissions', () => {
      const analyses = [
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: '2026-03-01', truthScore: 72 }, // 59 days = 1.0
        { createdAt: '2026-05-01', truthScore: 75 }, // 61 days = 1.0
        { createdAt: '2026-07-01', truthScore: 78 }  // 61 days = 1.0
      ]
      // 1 + 1.0 + 1.0 + 1.0 = 4.0
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBe(4)
    })
  })

  describe('date format handling', () => {
    it('should handle Date objects', () => {
      const analyses = [
        { createdAt: new Date('2026-01-01'), truthScore: 70 },
        { createdAt: new Date('2026-02-01'), truthScore: 75 }
      ]
      // 31 days = 1.0
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBe(2)
    })

    it('should handle ISO string dates', () => {
      const analyses = [
        { createdAt: '2026-01-01T00:00:00.000Z', truthScore: 70 },
        { createdAt: '2026-02-01T00:00:00.000Z', truthScore: 75 }
      ]
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBe(2)
    })

    it('should handle mixed date formats', () => {
      const analyses = [
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: new Date('2026-02-01'), truthScore: 75 }
      ]
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBe(2)
    })
  })

  describe('rounding', () => {
    it('should round to one decimal place', () => {
      const analyses = [
        { createdAt: '2026-01-01', truthScore: 70 },
        { createdAt: '2026-01-03', truthScore: 75 }
      ]
      const result = calculateEffectiveSampleSizeWithDates(analyses)
      const decimalPlaces = (result.toString().split('.')[1] || '').length
      expect(decimalPlaces).toBeLessThanOrEqual(1)
    })
  })

  describe('boundary conditions', () => {
    it('should use 0.3 weight at exactly 23 hours apart', () => {
      const analyses = [
        { createdAt: '2026-01-01T00:00:00Z', truthScore: 70 },
        { createdAt: '2026-01-01T23:00:00Z', truthScore: 75 } // < 1 day
      ]
      // Should be same-day weight (0.3)
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(1.3, 1)
    })

    it('should use 0.6 weight at exactly 1 day apart', () => {
      const analyses = [
        { createdAt: '2026-01-01T00:00:00Z', truthScore: 70 },
        { createdAt: '2026-01-02T01:00:00Z', truthScore: 75 } // > 1 day, < 7 days
      ]
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(1.6, 1)
    })

    it('should use 0.85 weight at exactly 7 days apart', () => {
      const analyses = [
        { createdAt: '2026-01-01T00:00:00Z', truthScore: 70 },
        { createdAt: '2026-01-08T01:00:00Z', truthScore: 75 } // > 7 days, < 30 days
      ]
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBeCloseTo(1.9, 1)
    })

    it('should use 1.0 weight at exactly 30 days apart', () => {
      const analyses = [
        { createdAt: '2026-01-01T00:00:00Z', truthScore: 70 },
        { createdAt: '2026-01-31T01:00:00Z', truthScore: 75 } // > 30 days
      ]
      expect(calculateEffectiveSampleSizeWithDates(analyses)).toBe(2)
    })
  })
})

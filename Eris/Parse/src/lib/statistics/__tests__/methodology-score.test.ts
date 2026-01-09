/**
 * Unit Tests for Methodology Score Calculator
 */

import { describe, it, expect } from 'vitest'
import { calculateMethodologyScore } from '../methodology-score'

describe('calculateMethodologyScore', () => {
  describe('component weighting', () => {
    it('should weight evidence quality at 40%', () => {
      const baseInput = {
        avgEvidenceQuality: 40, // max
        avgMethodologyRigor: 0,
        primarySourceRate: 0,
        verifiedClaimRate: 0
      }
      // Evidence contributes: (40/40) * 40 = 40 points
      expect(calculateMethodologyScore(baseInput)).toBe(40)
    })

    it('should weight methodology rigor at 30%', () => {
      const baseInput = {
        avgEvidenceQuality: 0,
        avgMethodologyRigor: 25, // max
        primarySourceRate: 0,
        verifiedClaimRate: 0
      }
      // Rigor contributes: (25/25) * 30 = 30 points
      expect(calculateMethodologyScore(baseInput)).toBe(30)
    })

    it('should weight primary source rate at 15%', () => {
      const baseInput = {
        avgEvidenceQuality: 0,
        avgMethodologyRigor: 0,
        primarySourceRate: 1, // max
        verifiedClaimRate: 0
      }
      // Primary sources contribute: 1 * 15 = 15 points
      expect(calculateMethodologyScore(baseInput)).toBe(15)
    })

    it('should weight verified claim rate at 15%', () => {
      const baseInput = {
        avgEvidenceQuality: 0,
        avgMethodologyRigor: 0,
        primarySourceRate: 0,
        verifiedClaimRate: 1 // max
      }
      // Verification contributes: 1 * 15 = 15 points
      expect(calculateMethodologyScore(baseInput)).toBe(15)
    })
  })

  describe('perfect scores', () => {
    it('should return 100 for perfect input', () => {
      const perfectInput = {
        avgEvidenceQuality: 40,
        avgMethodologyRigor: 25,
        primarySourceRate: 1,
        verifiedClaimRate: 1
      }
      expect(calculateMethodologyScore(perfectInput)).toBe(100)
    })
  })

  describe('zero scores', () => {
    it('should return 0 for zero input', () => {
      const zeroInput = {
        avgEvidenceQuality: 0,
        avgMethodologyRigor: 0,
        primarySourceRate: 0,
        verifiedClaimRate: 0
      }
      expect(calculateMethodologyScore(zeroInput)).toBe(0)
    })
  })

  describe('partial scores', () => {
    it('should calculate correctly for half values', () => {
      const halfInput = {
        avgEvidenceQuality: 20, // 50% of 40
        avgMethodologyRigor: 12.5, // 50% of 25
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.5
      }
      // Evidence: (20/40) * 40 = 20
      // Rigor: (12.5/25) * 30 = 15
      // Primary: 0.5 * 15 = 7.5
      // Verified: 0.5 * 15 = 7.5
      // Total: 50
      expect(calculateMethodologyScore(halfInput)).toBe(50)
    })

    it('should handle realistic publication scores', () => {
      const realisticInput = {
        avgEvidenceQuality: 28, // Good evidence
        avgMethodologyRigor: 18, // Above average rigor
        primarySourceRate: 0.6, // 60% primary sources
        verifiedClaimRate: 0.75 // 75% claims verified
      }
      // Evidence: (28/40) * 40 = 28
      // Rigor: (18/25) * 30 = 21.6
      // Primary: 0.6 * 15 = 9
      // Verified: 0.75 * 15 = 11.25
      // Total: 69.85 → 69.9
      expect(calculateMethodologyScore(realisticInput)).toBeCloseTo(69.9, 1)
    })
  })

  describe('component isolation', () => {
    it('should increase score when only evidence quality increases', () => {
      const low = calculateMethodologyScore({
        avgEvidenceQuality: 10,
        avgMethodologyRigor: 15,
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.5
      })
      const high = calculateMethodologyScore({
        avgEvidenceQuality: 30,
        avgMethodologyRigor: 15,
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.5
      })
      expect(high).toBeGreaterThan(low)
      expect(high - low).toBeCloseTo(20, 1) // (30-10)/40 * 40 = 20
    })

    it('should increase score when only methodology rigor increases', () => {
      const low = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 5,
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.5
      })
      const high = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 20,
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.5
      })
      expect(high).toBeGreaterThan(low)
      expect(high - low).toBeCloseTo(18, 1) // (20-5)/25 * 30 = 18
    })

    it('should increase score when only primary source rate increases', () => {
      const low = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 15,
        primarySourceRate: 0.2,
        verifiedClaimRate: 0.5
      })
      const high = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 15,
        primarySourceRate: 0.8,
        verifiedClaimRate: 0.5
      })
      expect(high).toBeGreaterThan(low)
      expect(high - low).toBeCloseTo(9, 1) // (0.8-0.2) * 15 = 9
    })

    it('should increase score when only verified claim rate increases', () => {
      const low = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 15,
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.1
      })
      const high = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 15,
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.9
      })
      expect(high).toBeGreaterThan(low)
      expect(high - low).toBeCloseTo(12, 1) // (0.9-0.1) * 15 = 12
    })
  })

  describe('rounding', () => {
    it('should round to one decimal place', () => {
      const result = calculateMethodologyScore({
        avgEvidenceQuality: 17,
        avgMethodologyRigor: 13,
        primarySourceRate: 0.33,
        verifiedClaimRate: 0.67
      })
      const decimalPlaces = (result.toString().split('.')[1] || '').length
      expect(decimalPlaces).toBeLessThanOrEqual(1)
    })

    it('should handle values that result in clean numbers', () => {
      const result = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 12.5,
        primarySourceRate: 0.5,
        verifiedClaimRate: 0.5
      })
      expect(result).toBe(50)
    })
  })

  describe('boundary values', () => {
    it('should handle maximum evidence quality', () => {
      expect(calculateMethodologyScore({
        avgEvidenceQuality: 40,
        avgMethodologyRigor: 0,
        primarySourceRate: 0,
        verifiedClaimRate: 0
      })).toBe(40)
    })

    it('should handle maximum methodology rigor', () => {
      expect(calculateMethodologyScore({
        avgEvidenceQuality: 0,
        avgMethodologyRigor: 25,
        primarySourceRate: 0,
        verifiedClaimRate: 0
      })).toBe(30)
    })

    it('should handle rate values at 0', () => {
      const result = calculateMethodologyScore({
        avgEvidenceQuality: 20,
        avgMethodologyRigor: 12.5,
        primarySourceRate: 0,
        verifiedClaimRate: 0
      })
      // 20 + 15 + 0 + 0 = 35
      expect(result).toBe(35)
    })

    it('should handle rate values at 1', () => {
      const result = calculateMethodologyScore({
        avgEvidenceQuality: 0,
        avgMethodologyRigor: 0,
        primarySourceRate: 1,
        verifiedClaimRate: 1
      })
      // 0 + 0 + 15 + 15 = 30
      expect(result).toBe(30)
    })
  })

  describe('real-world scenarios', () => {
    it('should score high for well-sourced investigative journalism', () => {
      const result = calculateMethodologyScore({
        avgEvidenceQuality: 35, // Strong evidence
        avgMethodologyRigor: 22, // Rigorous methodology
        primarySourceRate: 0.85, // Mostly primary sources
        verifiedClaimRate: 0.9 // Most claims verified
      })
      expect(result).toBeGreaterThan(85)
    })

    it('should score low for opinion pieces with weak sourcing', () => {
      const result = calculateMethodologyScore({
        avgEvidenceQuality: 8, // Weak evidence
        avgMethodologyRigor: 5, // Poor methodology
        primarySourceRate: 0.15, // Few primary sources
        verifiedClaimRate: 0.2 // Most claims unverified
      })
      expect(result).toBeLessThan(25)
    })

    it('should score moderately for average news reporting', () => {
      const result = calculateMethodologyScore({
        avgEvidenceQuality: 22,
        avgMethodologyRigor: 14,
        primarySourceRate: 0.45,
        verifiedClaimRate: 0.55
      })
      expect(result).toBeGreaterThan(40)
      expect(result).toBeLessThan(70)
    })
  })

  describe('formula verification', () => {
    it('should follow exact formula: (eq/40)*40 + (mr/25)*30 + psr*15 + vcr*15', () => {
      const input = {
        avgEvidenceQuality: 32,
        avgMethodologyRigor: 20,
        primarySourceRate: 0.7,
        verifiedClaimRate: 0.8
      }

      const expected =
        (input.avgEvidenceQuality / 40) * 40 +
        (input.avgMethodologyRigor / 25) * 30 +
        input.primarySourceRate * 15 +
        input.verifiedClaimRate * 15

      const result = calculateMethodologyScore(input)
      expect(result).toBeCloseTo(Math.round(expected * 10) / 10, 1)
    })
  })
})

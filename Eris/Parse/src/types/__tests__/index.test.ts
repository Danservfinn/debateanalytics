/**
 * Unit Tests for Type Helper Functions
 */

import { describe, it, expect } from 'vitest'
import {
  getCredibilityLabel,
  getCredibilityColor,
  getSeverityColor,
  getFactualReliabilityLabel,
  getRhetoricalNeutralityLabel,
  getFactualReliabilityColor,
  getRhetoricalNeutralityColor,
  getSourceCredibilityColor,
  getBiasRiskColor,
  getContestedFactStatusColor,
  getClaimVerificationColor,
  getMissingPerspectiveColor,
  getConfidenceLevelColor,
  detectBreakingNews,
  getDeceptionTypeLabel,
  getClaimVerdictLabel,
  getClaimVerdictColor,
  getClaimVerdictIcon
} from '../index'

describe('getCredibilityLabel', () => {
  it('should return "high" for scores >= 80', () => {
    expect(getCredibilityLabel(80)).toBe('high')
    expect(getCredibilityLabel(90)).toBe('high')
    expect(getCredibilityLabel(100)).toBe('high')
  })

  it('should return "moderate" for scores >= 60 and < 80', () => {
    expect(getCredibilityLabel(60)).toBe('moderate')
    expect(getCredibilityLabel(70)).toBe('moderate')
    expect(getCredibilityLabel(79)).toBe('moderate')
  })

  it('should return "low" for scores >= 40 and < 60', () => {
    expect(getCredibilityLabel(40)).toBe('low')
    expect(getCredibilityLabel(50)).toBe('low')
    expect(getCredibilityLabel(59)).toBe('low')
  })

  it('should return "very_low" for scores < 40', () => {
    expect(getCredibilityLabel(0)).toBe('very_low')
    expect(getCredibilityLabel(20)).toBe('very_low')
    expect(getCredibilityLabel(39)).toBe('very_low')
  })
})

describe('getCredibilityColor', () => {
  it('should return green for high credibility', () => {
    expect(getCredibilityColor('high')).toBe('#22c55e')
  })

  it('should return amber for moderate credibility', () => {
    expect(getCredibilityColor('moderate')).toBe('#f59e0b')
  })

  it('should return orange for low credibility', () => {
    expect(getCredibilityColor('low')).toBe('#f97316')
  })

  it('should return red for very_low credibility', () => {
    expect(getCredibilityColor('very_low')).toBe('#ef4444')
  })
})

describe('getSeverityColor', () => {
  it('should return red for high severity', () => {
    expect(getSeverityColor('high')).toBe('#ef4444')
  })

  it('should return amber for medium severity', () => {
    expect(getSeverityColor('medium')).toBe('#f59e0b')
  })

  it('should return green for low severity', () => {
    expect(getSeverityColor('low')).toBe('#22c55e')
  })
})

describe('getFactualReliabilityLabel', () => {
  it('should return VERIFIED for scores >= 80', () => {
    expect(getFactualReliabilityLabel(80)).toBe('VERIFIED')
    expect(getFactualReliabilityLabel(100)).toBe('VERIFIED')
  })

  it('should return MOSTLY_VERIFIED for scores >= 60', () => {
    expect(getFactualReliabilityLabel(60)).toBe('MOSTLY_VERIFIED')
    expect(getFactualReliabilityLabel(79)).toBe('MOSTLY_VERIFIED')
  })

  it('should return PARTIALLY_VERIFIED for scores >= 40', () => {
    expect(getFactualReliabilityLabel(40)).toBe('PARTIALLY_VERIFIED')
    expect(getFactualReliabilityLabel(59)).toBe('PARTIALLY_VERIFIED')
  })

  it('should return UNVERIFIED for scores >= 20', () => {
    expect(getFactualReliabilityLabel(20)).toBe('UNVERIFIED')
    expect(getFactualReliabilityLabel(39)).toBe('UNVERIFIED')
  })

  it('should return CONTAINS_FALSE_CLAIMS for scores < 20', () => {
    expect(getFactualReliabilityLabel(0)).toBe('CONTAINS_FALSE_CLAIMS')
    expect(getFactualReliabilityLabel(19)).toBe('CONTAINS_FALSE_CLAIMS')
  })
})

describe('getRhetoricalNeutralityLabel', () => {
  it('should return NEUTRAL for scores >= 80', () => {
    expect(getRhetoricalNeutralityLabel(80)).toBe('NEUTRAL')
    expect(getRhetoricalNeutralityLabel(100)).toBe('NEUTRAL')
  })

  it('should return SLIGHTLY_BIASED for scores >= 60', () => {
    expect(getRhetoricalNeutralityLabel(60)).toBe('SLIGHTLY_BIASED')
    expect(getRhetoricalNeutralityLabel(79)).toBe('SLIGHTLY_BIASED')
  })

  it('should return MODERATELY_BIASED for scores >= 40', () => {
    expect(getRhetoricalNeutralityLabel(40)).toBe('MODERATELY_BIASED')
    expect(getRhetoricalNeutralityLabel(59)).toBe('MODERATELY_BIASED')
  })

  it('should return HIGHLY_BIASED for scores >= 20', () => {
    expect(getRhetoricalNeutralityLabel(20)).toBe('HIGHLY_BIASED')
    expect(getRhetoricalNeutralityLabel(39)).toBe('HIGHLY_BIASED')
  })

  it('should return PROPAGANDA for scores < 20', () => {
    expect(getRhetoricalNeutralityLabel(0)).toBe('PROPAGANDA')
    expect(getRhetoricalNeutralityLabel(19)).toBe('PROPAGANDA')
  })
})

describe('getFactualReliabilityColor', () => {
  it('should return correct colors for each label', () => {
    expect(getFactualReliabilityColor('VERIFIED')).toBe('#22c55e')
    expect(getFactualReliabilityColor('MOSTLY_VERIFIED')).toBe('#84cc16')
    expect(getFactualReliabilityColor('PARTIALLY_VERIFIED')).toBe('#f59e0b')
    expect(getFactualReliabilityColor('UNVERIFIED')).toBe('#f97316')
    expect(getFactualReliabilityColor('CONTAINS_FALSE_CLAIMS')).toBe('#ef4444')
  })

  it('should return gray for unknown labels', () => {
    expect(getFactualReliabilityColor('UNKNOWN')).toBe('#6b7280')
  })
})

describe('getRhetoricalNeutralityColor', () => {
  it('should return correct colors for each label', () => {
    expect(getRhetoricalNeutralityColor('NEUTRAL')).toBe('#22c55e')
    expect(getRhetoricalNeutralityColor('SLIGHTLY_BIASED')).toBe('#84cc16')
    expect(getRhetoricalNeutralityColor('MODERATELY_BIASED')).toBe('#f59e0b')
    expect(getRhetoricalNeutralityColor('HIGHLY_BIASED')).toBe('#f97316')
    expect(getRhetoricalNeutralityColor('PROPAGANDA')).toBe('#ef4444')
  })

  it('should return gray for unknown labels', () => {
    expect(getRhetoricalNeutralityColor('UNKNOWN')).toBe('#6b7280')
  })
})

describe('getSourceCredibilityColor', () => {
  it('should return green for scores >= 8', () => {
    expect(getSourceCredibilityColor(8)).toBe('#22c55e')
    expect(getSourceCredibilityColor(10)).toBe('#22c55e')
  })

  it('should return lime for scores >= 6', () => {
    expect(getSourceCredibilityColor(6)).toBe('#84cc16')
    expect(getSourceCredibilityColor(7)).toBe('#84cc16')
  })

  it('should return amber for scores >= 4', () => {
    expect(getSourceCredibilityColor(4)).toBe('#f59e0b')
    expect(getSourceCredibilityColor(5)).toBe('#f59e0b')
  })

  it('should return orange for scores >= 2', () => {
    expect(getSourceCredibilityColor(2)).toBe('#f97316')
    expect(getSourceCredibilityColor(3)).toBe('#f97316')
  })

  it('should return red for scores < 2', () => {
    expect(getSourceCredibilityColor(0)).toBe('#ef4444')
    expect(getSourceCredibilityColor(1)).toBe('#ef4444')
  })
})

describe('getBiasRiskColor', () => {
  it('should return correct colors for each risk level', () => {
    expect(getBiasRiskColor('HIGH')).toBe('#ef4444')
    expect(getBiasRiskColor('MEDIUM')).toBe('#f59e0b')
    expect(getBiasRiskColor('LOW')).toBe('#22c55e')
  })
})

describe('getContestedFactStatusColor', () => {
  it('should return correct colors for each status', () => {
    expect(getContestedFactStatusColor('DISPUTED')).toBe('#f59e0b')
    expect(getContestedFactStatusColor('LIKELY_TRUE')).toBe('#84cc16')
    expect(getContestedFactStatusColor('LIKELY_FALSE')).toBe('#f97316')
    expect(getContestedFactStatusColor('UNKNOWN')).toBe('#6b7280')
  })
})

describe('getClaimVerificationColor', () => {
  it('should return correct colors for each verification status', () => {
    expect(getClaimVerificationColor('VERIFIED')).toBe('#22c55e')
    expect(getClaimVerificationColor('LIKELY_TRUE')).toBe('#84cc16')
    expect(getClaimVerificationColor('DISPUTED')).toBe('#f59e0b')
    expect(getClaimVerificationColor('LIKELY_FALSE')).toBe('#f97316')
    expect(getClaimVerificationColor('FALSE')).toBe('#ef4444')
    expect(getClaimVerificationColor('UNVERIFIABLE')).toBe('#6b7280')
  })

  it('should return gray for unknown status', () => {
    expect(getClaimVerificationColor('UNKNOWN')).toBe('#6b7280')
  })
})

describe('getMissingPerspectiveColor', () => {
  it('should return correct colors for each importance level', () => {
    expect(getMissingPerspectiveColor('CRITICAL')).toBe('#ef4444')
    expect(getMissingPerspectiveColor('SIGNIFICANT')).toBe('#f59e0b')
    expect(getMissingPerspectiveColor('NOTABLE')).toBe('#6b7280')
  })
})

describe('getConfidenceLevelColor', () => {
  it('should return correct colors for each confidence level', () => {
    expect(getConfidenceLevelColor('HIGH')).toBe('#22c55e')
    expect(getConfidenceLevelColor('MODERATE')).toBe('#f59e0b')
    expect(getConfidenceLevelColor('LOW')).toBe('#ef4444')
  })
})

describe('detectBreakingNews', () => {
  it('should detect breaking news for very recent articles', () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - (1 * 60 * 60 * 1000))
    const result = detectBreakingNews(oneHourAgo.toISOString())

    expect(result.isBreakingNews).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('should not flag old articles as breaking news', () => {
    // Use a fixed date far enough in the past
    // The function considers hoursAfterEvent < 48 OR hoursSincePublish < 72
    // When no eventDate is provided, hoursAfterEvent = 0, so it will always be < 48
    // Testing with eventDate to avoid this edge case
    const oldEventDate = '2024-01-01T12:00:00Z'
    const oldArticleDate = '2024-01-05T12:00:00Z' // 96 hours after event
    const result = detectBreakingNews(oldArticleDate, oldEventDate)

    // hoursAfterEvent = 96 (not < 48), hoursSincePublish = ~2 years (not < 72)
    expect(result.isBreakingNews).toBe(false)
  })

  it('should include warnings for articles within 24 hours of event', () => {
    const eventDate = '2026-01-08T10:00:00Z'
    const articleDate = '2026-01-08T20:00:00Z' // 10 hours after event
    const result = detectBreakingNews(articleDate, eventDate)

    expect(result.warnings).toContain(
      'Article published within 24 hours of event - facts may be incomplete or inaccurate'
    )
  })

  it('should include warnings for articles within 48 hours of event', () => {
    const eventDate = '2026-01-07T10:00:00Z'
    const articleDate = '2026-01-08T20:00:00Z' // 34 hours after event
    const result = detectBreakingNews(articleDate, eventDate)

    expect(result.warnings).toContain(
      'Early reporting typically relies heavily on official statements'
    )
  })

  it('should provide recommendation for reanalysis', () => {
    const eventDate = '2026-01-08T12:00:00Z'
    const result = detectBreakingNews('2026-01-08T14:00:00Z', eventDate)

    expect(result.recommendReanalysisAfter).toBeDefined()
    // Should be 72 hours after event
    const recommendDate = new Date(result.recommendReanalysisAfter!)
    const eventDateTime = new Date(eventDate)
    const hoursDiff = (recommendDate.getTime() - eventDateTime.getTime()) / (1000 * 60 * 60)
    expect(hoursDiff).toBeCloseTo(72, 0)
  })

  it('should handle missing event date by using publish date', () => {
    const publishDate = '2026-01-08T12:00:00Z'
    const result = detectBreakingNews(publishDate)

    expect(result.hoursAfterEvent).toBe(0) // Same as publish date
  })
})

describe('getDeceptionTypeLabel', () => {
  it('should return human-readable labels for emotional deception types', () => {
    expect(getDeceptionTypeLabel('fear_appeal')).toBe('Fear Appeal')
    expect(getDeceptionTypeLabel('appeal_to_pity')).toBe('Appeal to Pity')
    expect(getDeceptionTypeLabel('appeal_to_anger')).toBe('Appeal to Anger')
  })

  it('should return human-readable labels for framing deception types', () => {
    expect(getDeceptionTypeLabel('false_balance')).toBe('False Balance')
    expect(getDeceptionTypeLabel('context_stripping')).toBe('Context Stripping')
    expect(getDeceptionTypeLabel('narrative_priming')).toBe('Narrative Priming')
    expect(getDeceptionTypeLabel('selection_bias')).toBe('Selection Bias')
  })

  it('should return human-readable labels for omission deception types', () => {
    expect(getDeceptionTypeLabel('counter_evidence')).toBe('Counter-Evidence Omitted')
    expect(getDeceptionTypeLabel('alternative_perspective')).toBe('Alternative Perspective Absent')
    expect(getDeceptionTypeLabel('critical_context')).toBe('Critical Context Omitted')
    expect(getDeceptionTypeLabel('historical_context')).toBe('Historical Context Missing')
  })

  it('should return human-readable labels for source deception types', () => {
    expect(getDeceptionTypeLabel('anonymous_experts')).toBe('Anonymous Experts')
    expect(getDeceptionTypeLabel('circular_sourcing')).toBe('Circular Sourcing')
    expect(getDeceptionTypeLabel('hidden_funding')).toBe('Hidden Funding')
    expect(getDeceptionTypeLabel('credential_inflation')).toBe('Credential Inflation')
  })

  it('should return human-readable labels for propaganda deception types', () => {
    expect(getDeceptionTypeLabel('talking_point_repetition')).toBe('Talking Point Repetition')
    expect(getDeceptionTypeLabel('us_vs_them')).toBe('Us vs. Them Framing')
    expect(getDeceptionTypeLabel('slogan_over_substance')).toBe('Slogan Over Substance')
    expect(getDeceptionTypeLabel('authority_without_evidence')).toBe('Authority Without Evidence')
  })
})

describe('getClaimVerdictLabel', () => {
  it('should return correct labels for each verdict', () => {
    expect(getClaimVerdictLabel('verified')).toBe('Verified')
    expect(getClaimVerdictLabel('mostly_true')).toBe('Mostly True')
    expect(getClaimVerdictLabel('partially_true')).toBe('Partially True')
    expect(getClaimVerdictLabel('misleading')).toBe('Misleading')
    expect(getClaimVerdictLabel('mostly_false')).toBe('Mostly False')
    expect(getClaimVerdictLabel('false')).toBe('False')
    expect(getClaimVerdictLabel('unverifiable')).toBe('Unverifiable')
  })
})

describe('getClaimVerdictColor', () => {
  it('should return correct colors for each verdict', () => {
    expect(getClaimVerdictColor('verified')).toBe('#22c55e')
    expect(getClaimVerdictColor('mostly_true')).toBe('#84cc16')
    expect(getClaimVerdictColor('partially_true')).toBe('#f59e0b')
    expect(getClaimVerdictColor('misleading')).toBe('#f97316')
    expect(getClaimVerdictColor('mostly_false')).toBe('#ef4444')
    expect(getClaimVerdictColor('false')).toBe('#dc2626')
    expect(getClaimVerdictColor('unverifiable')).toBe('#6b7280')
  })
})

describe('getClaimVerdictIcon', () => {
  it('should return correct icons for each verdict', () => {
    expect(getClaimVerdictIcon('verified')).toBe('✓')
    expect(getClaimVerdictIcon('mostly_true')).toBe('≈')
    expect(getClaimVerdictIcon('partially_true')).toBe('~')
    expect(getClaimVerdictIcon('misleading')).toBe('⚠')
    expect(getClaimVerdictIcon('mostly_false')).toBe('✗')
    expect(getClaimVerdictIcon('false')).toBe('✗')
    expect(getClaimVerdictIcon('unverifiable')).toBe('?')
  })
})

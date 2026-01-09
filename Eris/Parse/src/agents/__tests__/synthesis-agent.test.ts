/**
 * SynthesisAgent Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the zai module
vi.mock('@/lib/zai', () => ({
  callGLM: vi.fn(),
  callGLMWithRetry: vi.fn(),
  extractJSON: vi.fn(),
}))

import { synthesizeAnalysis, createShareableCard } from '../synthesis-agent'
import { callGLM, callGLMWithRetry, extractJSON } from '@/lib/zai'
import type { ParseAnalysis } from '@/types'

const mockedCallGLM = vi.mocked(callGLM)
const mockedCallGLMWithRetry = vi.mocked(callGLMWithRetry)
const mockedExtractJSON = vi.mocked(extractJSON)

describe('SynthesisAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockInput = {
    article: {
      id: 'test-article',
      url: 'https://example.com/article',
      title: 'Test Article',
      authors: ['Author'],
      publication: 'Test Pub',
      publishDate: '2024-01-15',
      articleType: 'news' as const,
      content: { headline: 'Test', subhead: null, lede: '', body: '', sections: [] },
      claims: [],
      sources: [],
      statistics: [],
      emotionalLanguageDensity: 0.2,
    },
    steelMannedPerspectives: [
      {
        id: 'p1',
        originalPerspective: 'Original view',
        steelMannedVersion: 'Stronger version',
        strengthScore: 80,
        keyArguments: ['Arg 1'],
        evidenceUsed: ['Evidence 1'],
        weaknesses: [],
      },
    ],
    deceptionDetected: [],
    factCheckResults: [],
    fallacies: [],
    contextAudit: {
      omissions: [],
      framing: [],
      narrativeStructure: 'neutral',
      overallScore: 80,
    },
  }

  describe('synthesizeAnalysis', () => {
    it('should calculate truth score from GLM response', async () => {
      mockedCallGLMWithRetry.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        evidenceQuality: 30,
        methodologyRigor: 20,
        logicalStructure: 15,
        manipulationAbsence: 12,
        whatAiThinks: 'This is a well-sourced article.',
        credibility: 'high',
      })

      const result = await synthesizeAnalysis(mockInput)

      expect(result.truthScore).toBe(77) // 30 + 20 + 15 + 12
      expect(result.breakdown.evidenceQuality).toBe(30)
      expect(result.breakdown.methodologyRigor).toBe(20)
      expect(result.breakdown.logicalStructure).toBe(15)
      expect(result.breakdown.manipulationAbsence).toBe(12)
      expect(result.credibility).toBe('high')
      expect(result.whatAiThinks).toBe('This is a well-sourced article.')
    })

    it('should clamp scores to valid ranges', async () => {
      mockedCallGLMWithRetry.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        finishReason: 'stop',
      })

      // Scores exceeding maximums
      mockedExtractJSON.mockReturnValueOnce({
        evidenceQuality: 50, // Max is 40
        methodologyRigor: 30, // Max is 25
        logicalStructure: 25, // Max is 20
        manipulationAbsence: 20, // Max is 15
        credibility: 'high',
      })

      const result = await synthesizeAnalysis(mockInput)

      expect(result.breakdown.evidenceQuality).toBe(40)
      expect(result.breakdown.methodologyRigor).toBe(25)
      expect(result.breakdown.logicalStructure).toBe(20)
      expect(result.breakdown.manipulationAbsence).toBe(15)
      expect(result.truthScore).toBe(100) // Maximum possible
    })

    it('should handle negative scores by clamping to 0', async () => {
      mockedCallGLMWithRetry.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        evidenceQuality: -5,
        methodologyRigor: -10,
        logicalStructure: -3,
        manipulationAbsence: -8,
        credibility: 'very_low',
      })

      const result = await synthesizeAnalysis(mockInput)

      expect(result.breakdown.evidenceQuality).toBe(0)
      expect(result.breakdown.methodologyRigor).toBe(0)
      expect(result.breakdown.logicalStructure).toBe(0)
      expect(result.breakdown.manipulationAbsence).toBe(0)
      expect(result.truthScore).toBe(0)
    })

    it('should handle missing scores with defaults (defensive behavior)', async () => {
      mockedCallGLMWithRetry.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        finishReason: 'stop',
      })

      // Missing all score fields - agent uses defaults (20 + 12 + 10 + 8 = 50)
      mockedExtractJSON.mockReturnValueOnce({
        credibility: 'low',
      })

      const result = await synthesizeAnalysis(mockInput)

      // Agent now uses default scores instead of 0
      expect(result.truthScore).toBe(50) // Default scores: 20 + 12 + 10 + 8
      expect(result.breakdown.evidenceQuality).toBe(20)
      expect(result.breakdown.methodologyRigor).toBe(12)
      expect(result.breakdown.logicalStructure).toBe(10)
      expect(result.breakdown.manipulationAbsence).toBe(8)
      expect(result.credibility).toBe('low') // Provided in mock
    })

    it('should throw error on GLM failure', async () => {
      mockedCallGLMWithRetry.mockResolvedValueOnce({
        success: false,
        error: 'API unavailable',
        text: '',
        model: 'glm-4.7',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })

      await expect(synthesizeAnalysis(mockInput))
        .rejects.toThrow('Synthesis failed: API unavailable')
    })

    it('should use defaults on invalid JSON response (defensive behavior)', async () => {
      mockedCallGLMWithRetry.mockResolvedValueOnce({
        success: true,
        text: 'not json',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce(null)

      // Agent now uses default scores instead of throwing
      const result = await synthesizeAnalysis(mockInput)
      expect(result.truthScore).toBe(50) // Default scores: 20 + 12 + 10 + 8
      expect(result.credibility).toBe('low') // Score 50 = low (40-59)
      expect(result.whatAiThinks).toContain('warrants careful evaluation')
    })

    it('should calculate credibility from score when not provided', async () => {
      mockedCallGLMWithRetry.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        evidenceQuality: 28,  // Score 60+ needed for moderate
        methodologyRigor: 18,
        logicalStructure: 12,
        manipulationAbsence: 10,
        // No credibility field - calculated from score (28+18+12+10=68)
      })

      const result = await synthesizeAnalysis(mockInput)

      expect(result.truthScore).toBe(68)
      expect(result.credibility).toBe('moderate') // Score 68 = moderate (60-79)
    })
  })

  describe('createShareableCard', () => {
    const baseAnalysis: ParseAnalysis = {
      id: 'analysis-123',
      articleId: 'article-456',
      url: 'https://example.com/article',
      userId: 'user-789',
      truthScore: 75,
      credibility: 'moderate',
      scoreBreakdown: {
        evidenceQuality: 28,
        methodologyRigor: 20,
        logicalStructure: 15,
        manipulationAbsence: 12,
      },
      steelMannedPerspectives: [],
      deceptionDetected: [],
      factCheckResults: [],
      fallacies: [],
      contextAudit: { omissions: [], framing: [], narrativeStructure: '', overallScore: 0 },
      whatAiThinks: 'Test analysis',
      analyzedAt: new Date().toISOString(),
    }

    it('should create summary with correct scores', () => {
      const card = createShareableCard(baseAnalysis)

      expect(card.summary).toContain('75/100')
      expect(card.summary).toContain('MODERATE')
      expect(card.summary).toContain('Evidence Quality: 28/40')
      expect(card.summary).toContain('Methodology Rigor: 20/25')
      expect(card.summary).toContain('Logical Structure: 15/20')
      expect(card.summary).toContain('Manipulation Absence: 12/15')
    })

    it('should return correct badge for high credibility', () => {
      const highCred = { ...baseAnalysis, credibility: 'high' as const }
      const card = createShareableCard(highCred)
      expect(card.scoreBadge).toBe('✅')
    })

    it('should return correct badge for moderate credibility', () => {
      const card = createShareableCard(baseAnalysis)
      expect(card.scoreBadge).toBe('⚠️')
    })

    it('should return correct badge for low credibility', () => {
      const lowCred = { ...baseAnalysis, credibility: 'low' as const }
      const card = createShareableCard(lowCred)
      expect(card.scoreBadge).toBe('❌')
    })

    it('should return correct badge for very_low credibility', () => {
      const veryLowCred = { ...baseAnalysis, credibility: 'very_low' as const }
      const card = createShareableCard(veryLowCred)
      expect(card.scoreBadge).toBe('🚫')
    })

    it('should generate correct share URL', () => {
      const card = createShareableCard(baseAnalysis)
      expect(card.shareUrl).toContain('/analyze/result/analysis-123')
    })
  })
})

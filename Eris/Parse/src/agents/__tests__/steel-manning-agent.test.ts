/**
 * SteelManningAgent Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/zai', () => ({
  callGLM: vi.fn(),
  extractJSON: vi.fn(),
}))

import { steelManArticle } from '../steel-manning-agent'
import { callGLM, extractJSON } from '@/lib/zai'
import type { ExtractedArticle } from '@/types'

const mockedCallGLM = vi.mocked(callGLM)
const mockedExtractJSON = vi.mocked(extractJSON)

describe('SteelManningAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Mock article with sufficient content (body >= 50 chars) to pass validation
  const mockArticle: ExtractedArticle = {
    id: 'test-article',
    url: 'https://example.com/article',
    title: 'Test Article',
    authors: ['Author'],
    publication: 'Test Pub',
    publishDate: '2024-01-15',
    articleType: 'news',
    content: { headline: 'Test', subhead: null, lede: '', body: 'This is a test article body with sufficient content to pass the minimum 50 character validation check.', sections: [] },
    claims: [{ id: '1', text: 'Claim 1', type: 'factual', verifiability: 'testable', section: 'main', context: '' }],
    sources: [],
    statistics: [],
    emotionalLanguageDensity: 0.2,
  }

  // Mock article with insufficient content (fails validation)
  const invalidArticle: ExtractedArticle = {
    id: 'invalid-article',
    url: 'https://example.com/invalid',
    title: 'Untitled Article', // Invalid title
    authors: [],
    publication: 'Unknown Publication',
    publishDate: '2024-01-15',
    articleType: 'news',
    content: { headline: '', subhead: null, lede: '', body: 'Short', sections: [] },
    claims: [],
    sources: [],
    statistics: [],
    emotionalLanguageDensity: 0,
  }

  describe('steelManArticle', () => {
    it('should extract and validate perspectives from GLM response', async () => {
      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        perspectives: [
          {
            label: 'Pro Position',
            originalStrength: 'strong',
            steelMannedVersion: {
              coreClaim: 'The main argument is X',
              strongestArguments: ['Arg 1', 'Arg 2'],
              bestEvidence: ['Evidence 1'],
              logicalStructure: 'If A then B, therefore C',
              anticipatedCounterarguments: ['Counter 1'],
              qualityScore: 85,
            },
            sourceInArticle: ['paragraph 1'],
            isImplicit: false,
          },
          {
            label: 'Con Position',
            originalStrength: 'weak',
            steelMannedVersion: {
              coreClaim: 'The opposing argument is Y',
              strongestArguments: ['Counter Arg'],
              bestEvidence: [],
              logicalStructure: 'Basic logic',
              anticipatedCounterarguments: [],
              qualityScore: 60,
            },
            sourceInArticle: [],
            isImplicit: true,
          },
        ],
      })

      const result = await steelManArticle({ article: mockArticle })

      expect(result).toHaveLength(2)
      expect(result[0].label).toBe('Pro Position')
      expect(result[0].originalStrength).toBe('strong')
      expect(result[0].steelMannedVersion.qualityScore).toBe(85)
      expect(result[0].isImplicit).toBe(false)
      expect(result[1].label).toBe('Con Position')
      expect(result[1].isImplicit).toBe(true)
    })

    it('should clamp quality score between 0 and 100', async () => {
      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        perspectives: [
          {
            label: 'High Score',
            steelMannedVersion: { qualityScore: 150 }, // Should clamp to 100
          },
          {
            label: 'Low Score',
            steelMannedVersion: { qualityScore: -20 }, // Should clamp to 0
          },
        ],
      })

      const result = await steelManArticle({ article: mockArticle })

      expect(result[0].steelMannedVersion.qualityScore).toBe(100)
      expect(result[1].steelMannedVersion.qualityScore).toBe(0)
    })

    it('should apply defaults for missing fields', async () => {
      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        finishReason: 'stop',
      })

      // Minimal perspective data
      mockedExtractJSON.mockReturnValueOnce({
        perspectives: [{}],
      })

      const result = await steelManArticle({ article: mockArticle })

      expect(result).toHaveLength(1)
      expect(result[0].label).toBe('Unnamed Perspective')
      expect(result[0].originalStrength).toBe('moderate')
      expect(result[0].steelMannedVersion.coreClaim).toBe('')
      expect(result[0].steelMannedVersion.strongestArguments).toEqual([])
      expect(result[0].steelMannedVersion.qualityScore).toBe(50)
      expect(result[0].isImplicit).toBe(false)
    })

    it('should throw error on GLM failure', async () => {
      mockedCallGLM.mockResolvedValueOnce({
        success: false,
        error: 'Rate limit exceeded',
        text: '',
        model: 'glm-4.7',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })

      await expect(steelManArticle({ article: mockArticle }))
        .rejects.toThrow('Steel-manning failed: Rate limit exceeded')
    })

    it('should return empty array on invalid response format (defensive behavior)', async () => {
      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        finishReason: 'stop',
      })

      // Missing perspectives array - agent returns empty array instead of throwing
      mockedExtractJSON.mockReturnValueOnce({ data: [] })

      const result = await steelManArticle({ article: mockArticle })
      expect(result).toEqual([])
    })

    it('should return empty array on null JSON response (defensive behavior)', async () => {
      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: 'not json',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce(null)

      const result = await steelManArticle({ article: mockArticle })
      expect(result).toEqual([])
    })

    it('should return empty array for invalid article content without calling GLM', async () => {
      // Invalid article should return empty without API call
      const result = await steelManArticle({ article: invalidArticle })

      expect(result).toEqual([])
      expect(mockedCallGLM).not.toHaveBeenCalled()
    })

    it('should generate unique IDs for each perspective', async () => {
      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.7',
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        perspectives: [
          { label: 'P1' },
          { label: 'P2' },
          { label: 'P3' },
        ],
      })

      const result = await steelManArticle({ article: mockArticle })

      const ids = result.map(p => p.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3) // All IDs should be unique
    })
  })
})

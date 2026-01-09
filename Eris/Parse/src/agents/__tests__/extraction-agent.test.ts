/**
 * ExtractionAgent Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the zai module
vi.mock('@/lib/zai', () => ({
  callGLM: vi.fn(),
  extractJSON: vi.fn(),
}))

import { extractArticle } from '../extraction-agent'
import { callGLM, extractJSON } from '@/lib/zai'

const mockedCallGLM = vi.mocked(callGLM)
const mockedExtractJSON = vi.mocked(extractJSON)

describe('ExtractionAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('extractArticle', () => {
    it('should fetch and extract article from URL', async () => {
      // Mock fetch
      const mockHtml = '<html><body><h1>Test Article</h1><p>Content</p></body></html>'
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      } as Response)

      // Mock GLM response
      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{"title": "Test Article"}',
        model: 'glm-4.5',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      })

      // Mock JSON extraction
      mockedExtractJSON.mockReturnValueOnce({
        title: 'Test Article',
        authors: ['John Doe'],
        publication: 'Test Publication',
        publishDate: '2024-01-15',
        articleType: 'news',
        content: {
          headline: 'Test Article',
          subhead: null,
          lede: 'This is the lede.',
          body: 'This is the body content.',
          sections: [],
        },
        claims: [
          { text: 'Test claim', type: 'factual', verifiability: 'testable', section: 'main', context: 'test' }
        ],
        sources: [
          { type: 'study', name: 'Test Study', url: 'https://example.com' }
        ],
        statistics: [],
        emotionalLanguageDensity: 0.1,
      })

      const result = await extractArticle({ url: 'https://example.com/article' })

      expect(result).toBeDefined()
      expect(result.title).toBe('Test Article')
      expect(result.authors).toEqual(['John Doe'])
      expect(result.claims).toHaveLength(1)
      expect(result.sources).toHaveLength(1)
      expect(result.emotionalLanguageDensity).toBe(0.1)
    })

    it('should use provided HTML instead of fetching', async () => {
      const mockHtml = '<html><body><h1>Pre-fetched</h1></body></html>'

      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.5',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        title: 'Pre-fetched Article',
        content: { headline: 'Pre-fetched', body: 'content' },
        claims: [],
        sources: [],
        statistics: [],
      })

      await extractArticle({ url: 'https://example.com', html: mockHtml })

      // Fetch should NOT have been called
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should throw error on fetch failure', async () => {
      // First mock: Jina Reader fetch fails
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Server Error',
        } as Response)
        // Second mock: Direct fetch also fails
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response)

      await expect(extractArticle({ url: 'https://example.com/notfound' }))
        .rejects.toThrow('Failed to fetch article')
    })

    it('should throw error on GLM failure', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      } as Response)

      mockedCallGLM.mockResolvedValueOnce({
        success: false,
        error: 'API Error',
        text: '',
        model: 'glm-4.5',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })

      await expect(extractArticle({ url: 'https://example.com' }))
        .rejects.toThrow('GLM extraction failed: API Error')
    })

    it('should throw error on JSON parse failure', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      } as Response)

      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: 'not json',
        model: 'glm-4.5',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce(null)

      await expect(extractArticle({ url: 'https://example.com' }))
        .rejects.toThrow('Failed to parse GLM response as JSON')
    })

    it('should handle body as array', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      } as Response)

      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.5',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        title: 'Test',
        content: {
          headline: 'Test',
          body: ['Paragraph 1', 'Paragraph 2', 'Paragraph 3'],
        },
        claims: [],
        sources: [],
        statistics: [],
        emotionalLanguageDensity: 0.1, // Provide density to avoid fallback calculation
      })

      const result = await extractArticle({ url: 'https://example.com' })

      expect(result.content.body).toBe('Paragraph 1\n\nParagraph 2\n\nParagraph 3')
    })

    it('should apply defaults for missing fields', async () => {
      // Use content too short to extract title (< 10 chars)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('short'),
      } as Response)

      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.5',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      })

      // Empty object - test all defaults
      mockedExtractJSON.mockReturnValueOnce({})

      const result = await extractArticle({ url: 'https://example.com' })

      // With no GLM title and no pre-extracted title (content too short), falls back to 'Untitled Article'
      expect(result.title).toBe('Untitled Article')
      expect(result.authors).toEqual([])
      // Publication extracted from URL when GLM returns nothing
      expect(result.publication).toBe('Example')
      expect(result.articleType).toBe('news')
      expect(result.claims).toEqual([])
      expect(result.sources).toEqual([])
      expect(result.statistics).toEqual([])
    })

    it('should clamp emotional density between 0 and 1', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      } as Response)

      mockedCallGLM.mockResolvedValueOnce({
        success: true,
        text: '{}',
        model: 'glm-4.5',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      })

      mockedExtractJSON.mockReturnValueOnce({
        title: 'Test',
        emotionalLanguageDensity: 1.5, // Should be clamped to 1
      })

      const result = await extractArticle({ url: 'https://example.com' })

      expect(result.emotionalLanguageDensity).toBe(1)
    })
  })
})

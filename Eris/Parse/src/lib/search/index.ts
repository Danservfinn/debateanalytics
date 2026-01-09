/**
 * Search Provider Abstraction Layer
 * Supports multiple search providers with automatic fallback
 */

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  credibility?: 'high' | 'medium' | 'low';
}

export interface SearchProvider {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  isAvailable(): Promise<boolean>;
}

export interface SearchOptions {
  limit?: number;
  dateRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  site?: string; // Restrict to specific site
}

// ============================================================================
// DuckDuckGo Provider (Primary)
// ============================================================================

export const DuckDuckGoProvider: SearchProvider = {
  name: 'DuckDuckGo',

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const limit = options.limit || 10;

      // Build query with site restriction if specified
      let searchQuery = query;
      if (options.site) {
        searchQuery = `${query} site:${options.site}`;
      }

      // Use DuckDuckGo HTML search (more reliable than Instant Answer API)
      const params = new URLSearchParams({
        q: searchQuery,
        kl: 'us-en', // Region
      });

      const response = await fetch(
        `https://html.duckduckgo.com/html/?${params.toString()}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`DuckDuckGo HTML search error: ${response.statusText}`);
      }

      const html = await response.text();

      // Parse HTML results using regex (lightweight, no DOM parser needed)
      const results: SearchResult[] = [];

      // Match result blocks: <a class="result__a" href="...">Title</a>
      // and snippets: <a class="result__snippet">...</a>
      const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*)</g;

      let match;
      while ((match = resultPattern.exec(html)) !== null && results.length < limit) {
        let url = match[1];
        const title = match[2].trim();
        const snippet = match[3].trim();

        // DDG wraps URLs in a redirect, extract the actual URL
        if (url.includes('uddg=')) {
          const urlMatch = url.match(/uddg=([^&]*)/);
          if (urlMatch) {
            url = decodeURIComponent(urlMatch[1]);
          }
        }

        if (title && url && url.startsWith('http')) {
          results.push({
            title,
            url,
            snippet: snippet || title,
            source: 'DuckDuckGo',
            credibility: 'medium',
          });
        }
      }

      // Fallback: simpler pattern if above didn't match
      if (results.length === 0) {
        const simplePattern = /<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/g;
        while ((match = simplePattern.exec(html)) !== null && results.length < limit) {
          let url = match[1];
          const title = match[2].trim();

          if (url.includes('uddg=')) {
            const urlMatch = url.match(/uddg=([^&]*)/);
            if (urlMatch) {
              url = decodeURIComponent(urlMatch[1]);
            }
          }

          if (title && url && url.startsWith('http')) {
            results.push({
              title,
              url,
              snippet: title,
              source: 'DuckDuckGo',
              credibility: 'medium',
            });
          }
        }
      }

      console.log(`DuckDuckGo HTML search returned ${results.length} results for: ${query.substring(0, 50)}...`);
      return results.slice(0, limit);
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      throw error;
    }
  },

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://html.duckduckgo.com/html/?q=test', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// Bing Search Provider (Fallback)
// ============================================================================

export const BingSearchProvider: SearchProvider = {
  name: 'Bing',

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const apiKey = process.env.BING_SEARCH_API_KEY;

    if (!apiKey) {
      throw new Error('Bing Search API key not configured');
    }

    try {
      const limit = options.limit || 10;
      const params = new URLSearchParams({
        q: query,
        count: limit.toString(),
      });

      // Add site restriction if specified
      if (options.site) {
        params.set('q', `${query} site:${options.site}`);
      }

      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?${params.toString()}`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Bing API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse Bing results
      const results: SearchResult[] = [];

      if (data.webPages && data.webPages.value) {
        for (const item of data.webPages.value) {
          results.push({
            title: item.name,
            url: item.url,
            snippet: item.snippet,
            source: 'Bing',
            credibility: 'medium',
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Bing search error:', error);
      throw error;
    }
  },

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = process.env.BING_SEARCH_API_KEY;
      return !!apiKey;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// Search Manager (Automatic Fallback)
// ============================================================================

class SearchManager {
  private providers: SearchProvider[] = [
    DuckDuckGoProvider,
    BingSearchProvider,
  ];

  /**
   * Search with automatic provider fallback
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<{ results: SearchResult[]; provider: string }> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        const isAvailable = await provider.isAvailable();

        if (!isAvailable) {
          console.log(`${provider.name} not available, skipping...`);
          continue;
        }

        console.log(`Searching with ${provider.name}...`);
        const results = await provider.search(query, options);

        console.log(`${provider.name} returned ${results.length} results`);

        return {
          results,
          provider: provider.name,
        };
      } catch (error) {
        console.error(`${provider.name} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }

    throw new Error(
      `All search providers failed. Last error: ${lastError?.message}`
    );
  }

  /**
   * Search multiple queries and aggregate results
   */
  async searchMultiple(
    queries: string[],
    options?: SearchOptions
  ): Promise<Map<string, SearchResult[]>> {
    const results = new Map<string, SearchResult[]>();

    for (const query of queries) {
      try {
        const { results: queryResults } = await this.search(query, options);
        results.set(query, queryResults);
      } catch (error) {
        console.error(`Failed to search for "${query}":`, error);
        results.set(query, []);
      }
    }

    return results;
  }

  /**
   * Search with query variations to avoid filter bubbles
   */
  async searchWithVariations(
    baseQuery: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const variations = [
      baseQuery,
      `"${baseQuery}"`, // Exact match
      `${baseQuery} study`, // Add academic context
      `${baseQuery} research`, // Add research context
      `${baseQuery} evidence`, // Add evidence context
    ];

    const allResults = await this.searchMultiple(variations, options);

    // Deduplicate by URL
    const uniqueResults = new Map<string, SearchResult>();

    for (const [, results] of allResults) {
      for (const result of results) {
        if (!uniqueResults.has(result.url)) {
          uniqueResults.set(result.url, result);
        }
      }
    }

    return Array.from(uniqueResults.values());
  }
}

// Export singleton instance
export const searchManager = new SearchManager();

// Export convenience function
export async function searchWeb(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const { results } = await searchManager.search(query, options);
  return results;
}

export async function searchWebWithVariations(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  return searchManager.searchWithVariations(query, options);
}

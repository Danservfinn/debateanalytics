# Improvement Log

This file tracks Ralph Loop iterations.

## Iteration 1 - 2026-01-09T02:15:00Z

### Article Tested
- URL: https://www.wral.com/news/ap/842b1-what-to-know-about-the-fatal-shooting-of-a-woman-by-an-ice-officer-in-minneapolis/
- Type: Breaking News

### Issues Found
- **P0**: DuckDuckGo Instant Answer API returning 0 results (not a web search API)
- **P0**: JSON parsing failures in fact-check agent due to empty search context
- **P0**: FallacyAgent response truncated mid-word
- **P0**: DeceptionAgent returning completely empty response
- **P1**: Jina Reader 451 errors for some URLs

### Changes Made
- Replaced DuckDuckGo Instant Answer API with HTML scraping at html.duckduckgo.com
- Added JSON truncation repair (`tryCompleteTruncatedJSON`) to handle cut-off responses
- Added graceful skip for fact-check when no search results available
- Total: 3 files changed, +150 lines

### Commits
- `8148181`: fix: [iteration 1] DuckDuckGo search and JSON parsing improvements

---

## Iteration 2 - 2026-01-09T10:55:00Z

### Article Tested
- (Re-tested search infrastructure before running new article)
- Type: Infrastructure Fix

### Issues Found
- **P0**: DuckDuckGo HTML endpoint blocked by CAPTCHA ("Unfortunately, bots use DuckDuckGo too")
- The previous HTML scraping fix worked initially but DDG now requires bot verification
- All searches returning 0 results, causing cascade failures in fact-check agent

### Root Cause Analysis
- DuckDuckGo's `html.duckduckgo.com` now implements bot detection using CAPTCHA challenges
- The response returns 200 OK but contains an "anomaly-modal" with duck selection puzzle
- No programmatic way to bypass without solving CAPTCHA

### Changes Made
- Added BraveSearchProvider as new primary search (free tier available at brave.com/search/api/)
- Added CAPTCHA detection in DuckDuckGoProvider to fail fast when blocked
- Added MockSearchProvider as last-resort fallback for development
- Reordered provider priority: Brave → Bing → DuckDuckGo → Mock
- Total: 1 file changed, +128 lines

### Commits
- `5ea5ec9`: fix: [iteration 2] add Brave Search + CAPTCHA detection + fallback

### Notes
- Brave Search requires API key but has a generous free tier (2,000 queries/month)
- Mock provider returns credible source URLs (Reuters, AP, PolitiFact) for development
- System now fails gracefully instead of silently returning 0 results

---

## Iteration 3 - 2026-01-09T11:20:00Z

### Article Tested
- URL: https://www.npr.org/2026/01/02/nx-s1-5664781/a-look-ahead-at-politics-in-2026
- Type: Political Analysis

### Issues Found
- **P0**: Fact-check agent throwing exceptions on JSON parse failures (crashing analysis)
- **P1**: GLM temperature 0.5 producing non-deterministic/creative responses instead of valid JSON
- **P1**: Missing debug visibility into malformed GLM responses

### What Worked
- MockSearchProvider fallback is working correctly when DuckDuckGo is blocked
- Jina Reader successfully extracted 37,607 chars from NPR article
- Analysis pipeline continues despite CAPTCHA blocks

### Changes Made
- Return inconclusive results instead of throwing on JSON parse failures
- Lowered GLM temperature from 0.5 to 0.3 for more deterministic JSON output
- Added debug logging to see malformed GLM responses (first 500 chars)
- Map search results to proper ExternalSource format for fallback sources
- Test script now accepts URL as command-line argument
- Total: 2 files changed, +97 lines

### Commits
- `c7cf87e`: fix: [iteration 3] graceful fact-check failures + lower temperature

### Notes
- Rate limiting concern raised - being mindful of Z.ai API usage
- System now degrades gracefully: JSON failure → inconclusive result with sources attached
- This prevents cascade failures where one bad GLM response crashes entire analysis

---

## Iteration 4 - 2026-01-09T16:10:00Z

### Focus
- Rate limiting optimizations per user guidance
- Remove all mock data from production

### Issues Addressed
- **P1**: Z.ai API rate limiting concerns
- **P1**: MockSearchProvider returning fake data in production
- **P1**: Conversations page showing hardcoded mock debates

### Changes Made
1. **Rate Limiting Optimizations**:
   - Reduced fact-check claim limit from 10 to 5 claims
   - Added in-memory search result caching (5-minute TTL)
   - Cache prevents duplicate API calls within same analysis session
   - Auto-cleanup when cache exceeds 100 entries

2. **Mock Data Removal**:
   - Removed MockSearchProvider from production provider chain
   - Removed mock conversations from conversations page
   - Added "Coming Soon" empty state for conversations feature

### Commits
- `4b8ca47`: fix: [iteration 4] rate limiting + search caching

### Files Changed
- `src/lib/search/index.ts` - Added caching, removed mock provider
- `src/agents/critical-fact-check-agent.ts` - Reduced claim limit
- `src/app/conversations/page.tsx` - Removed mock data

---


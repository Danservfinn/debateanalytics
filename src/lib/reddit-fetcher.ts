/**
 * Reddit Thread Fetcher - Pure TypeScript implementation
 * Fetches Reddit threads directly via the public JSON API
 * No Python dependency required - works in serverless environments
 */

export interface RedditThreadData {
  post: {
    id: string
    title: string
    author: string
    selftext: string
    subreddit: string
    score: number
    upvote_ratio: number
    num_comments: number
    created_utc: number
    permalink: string
    url: string
  }
  comments: RedditComment[]
  raw: unknown[]
}

export interface RedditComment {
  id: string
  author: string
  body: string
  score: number
  created_utc: number
  parent_id: string
  depth: number
  is_op: boolean
  controversiality: number
  has_delta: boolean
}

/**
 * Normalize any Reddit URL to the JSON API endpoint
 */
export function normalizeRedditUrl(url: string): string {
  let normalized = url.trim()

  // Add https if missing
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized
  }

  // Normalize to www.reddit.com
  normalized = normalized.replace(
    /https?:\/\/(old\.|new\.|www\.)?reddit\.com/i,
    'https://www.reddit.com'
  )

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '')

  // Remove .json if already present
  if (normalized.endsWith('.json')) {
    normalized = normalized.slice(0, -5)
  }

  // Remove query parameters
  normalized = normalized.split('?')[0]

  // Handle comment permalinks - extract just the post URL
  const match = normalized.match(/\/r\/(\w+)\/comments\/(\w+)/)
  if (match) {
    const [, subreddit, postId] = match
    normalized = `https://www.reddit.com/r/${subreddit}/comments/${postId}`
  }

  // Add .json
  return normalized + '.json'
}

/**
 * Extract subreddit and thread ID from URL
 */
export function parseRedditUrl(url: string): { subreddit: string; threadId: string } | null {
  const match = url.match(/\/r\/(\w+)\/comments\/(\w+)/i)
  if (!match) return null
  return { subreddit: match[1], threadId: match[2] }
}

/**
 * Recursively extract comments from Reddit's nested structure
 */
function extractCommentsRecursive(
  commentData: Record<string, unknown>,
  opAuthor: string,
  depth: number = 0
): RedditComment[] {
  const comments: RedditComment[] = []

  if (commentData.kind !== 't1') {
    return comments
  }

  const data = commentData.data as Record<string, unknown>
  const body = String(data.body || '')
  const author = String(data.author || '[deleted]')

  // Skip deleted/removed comments
  if (author === '[deleted]' || body === '[removed]' || body === '[deleted]') {
    return comments
  }

  const comment: RedditComment = {
    id: String(data.id || ''),
    author,
    body,
    score: Number(data.score || 0),
    created_utc: Number(data.created_utc || 0),
    parent_id: String(data.parent_id || ''),
    depth,
    is_op: Boolean(data.is_submitter) || author === opAuthor,
    controversiality: Number(data.controversiality || 0),
    has_delta: /!delta|δ|∆/i.test(body)
  }

  comments.push(comment)

  // Process nested replies
  const replies = data.replies
  if (replies && typeof replies === 'object') {
    const repliesData = replies as { data?: { children?: unknown[] } }
    if (repliesData.data?.children) {
      for (const reply of repliesData.data.children) {
        comments.push(...extractCommentsRecursive(reply as Record<string, unknown>, opAuthor, depth + 1))
      }
    }
  }

  return comments
}

/**
 * Fetch Reddit thread data via the public JSON API
 */
export async function fetchRedditThread(url: string): Promise<RedditThreadData> {
  const jsonUrl = normalizeRedditUrl(url)

  const response = await fetch(jsonUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    },
    // Increase timeout for slow Reddit responses
    signal: AbortSignal.timeout(30000)
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Reddit rate limit exceeded. Please try again in a few minutes.')
    }
    if (response.status === 404) {
      throw new Error('Thread not found. Please check the URL.')
    }
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as unknown[]

  if (!Array.isArray(data) || data.length < 2) {
    throw new Error('Invalid Reddit API response format')
  }

  // Extract post data
  const postListing = data[0] as { data?: { children?: Array<{ data?: Record<string, unknown> }> } }
  const postData = postListing?.data?.children?.[0]?.data

  if (!postData) {
    throw new Error('Could not extract post data from Reddit response')
  }

  const post = {
    id: String(postData.id || ''),
    title: String(postData.title || ''),
    author: String(postData.author || '[deleted]'),
    selftext: String(postData.selftext || ''),
    subreddit: String(postData.subreddit || ''),
    score: Number(postData.score || 0),
    upvote_ratio: Number(postData.upvote_ratio || 0),
    num_comments: Number(postData.num_comments || 0),
    created_utc: Number(postData.created_utc || 0),
    permalink: String(postData.permalink || ''),
    url: String(postData.url || '')
  }

  // Extract comments
  const commentsListing = data[1] as { data?: { children?: unknown[] } }
  const commentsData = commentsListing?.data?.children || []

  const comments: RedditComment[] = []
  for (const commentData of commentsData) {
    comments.push(...extractCommentsRecursive(commentData as Record<string, unknown>, post.author, 0))
  }

  return {
    post,
    comments,
    raw: data
  }
}

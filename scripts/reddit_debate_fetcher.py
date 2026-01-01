#!/usr/bin/env python3
"""
Reddit Debate Fetcher
Downloads Reddit threads and formats them for LLM analysis.

Usage:
    python reddit_debate_fetcher.py <reddit_url> [--output <filename>]

Examples:
    python reddit_debate_fetcher.py https://www.reddit.com/r/changemyview/comments/1pzzzih/cmv_if_we_actually_want_to_protect_children_we/
    python reddit_debate_fetcher.py "reddit.com/r/askreddit/comments/abc123/some_post" --output my_debate
"""

import json
import re
import sys
import ssl
import argparse
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path

# Create SSL context that doesn't verify certificates (for macOS compatibility)
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


def normalize_reddit_url(url: str) -> str:
    """Convert any Reddit URL format to the JSON API endpoint."""
    # Remove whitespace
    url = url.strip()

    # Add https if missing
    if not url.startswith('http'):
        url = 'https://' + url

    # Normalize to www.reddit.com
    url = re.sub(r'https?://(old\.|new\.|www\.)?reddit\.com', 'https://www.reddit.com', url)

    # Remove trailing slash
    url = url.rstrip('/')

    # Remove .json if already present (we'll add it back)
    if url.endswith('.json'):
        url = url[:-5]

    # Remove query parameters
    url = url.split('?')[0]

    # Handle comment permalinks - extract just the post URL to get full thread
    # This handles: /r/sub/comments/id/title/comment_id, /r/sub/comments/id/comment/comment_id, etc.
    match = re.search(r'/r/(\w+)/comments/(\w+)', url)
    if match:
        subreddit, post_id = match.groups()
        url = f'https://www.reddit.com/r/{subreddit}/comments/{post_id}'

    # Add .json
    return url + '.json'


def fetch_reddit_json(url: str) -> dict:
    """Fetch JSON data from Reddit API."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    req = Request(url, headers=headers)

    try:
        with urlopen(req, timeout=30, context=SSL_CONTEXT) as response:
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        raise Exception(f"HTTP Error {e.code}: {e.reason}")
    except URLError as e:
        raise Exception(f"URL Error: {e.reason}")


def extract_comments_recursive(comment_data: dict, depth: int = 0) -> list:
    """Recursively extract all comments from Reddit's nested structure."""
    comments = []

    if comment_data.get('kind') != 't1':
        return comments

    c = comment_data.get('data', {})

    comment = {
        'author': c.get('author', '[deleted]'),
        'score': c.get('score', 0),
        'body': c.get('body', '[removed]'),
        'depth': depth,
        'id': c.get('id', ''),
        'created_utc': c.get('created_utc', 0),
        'is_op': c.get('is_submitter', False),
        'controversiality': c.get('controversiality', 0),
        'replies': []
    }

    # Check for delta awards (CMV specific)
    body_lower = comment['body'].lower()
    comment['has_delta'] = any(d in body_lower for d in ['!delta', 'δ', '∆'])

    comments.append(comment)

    # Process replies
    replies = c.get('replies')
    if replies and isinstance(replies, dict):
        for reply in replies.get('data', {}).get('children', []):
            comments.extend(extract_comments_recursive(reply, depth + 1))

    return comments


def format_for_llm(data: dict) -> str:
    """Format Reddit data into clean, structured text optimized for LLM consumption."""

    # Extract post data
    post = data[0]['data']['children'][0]['data']
    comments_raw = data[1]['data']['children']

    # Extract all comments
    all_comments = []
    for comment in comments_raw:
        all_comments.extend(extract_comments_recursive(comment))

    # Build output
    lines = []

    # Header
    lines.append("=" * 80)
    lines.append("REDDIT THREAD ANALYSIS")
    lines.append("=" * 80)
    lines.append(f"Fetched: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")

    # Post metadata
    lines.append("## POST METADATA")
    lines.append(f"- Title: {post.get('title', 'N/A')}")
    lines.append(f"- Subreddit: r/{post.get('subreddit', 'N/A')}")
    lines.append(f"- Author: u/{post.get('author', '[deleted]')}")
    lines.append(f"- Score: {post.get('score', 0)} ({post.get('upvote_ratio', 0)*100:.0f}% upvoted)")
    lines.append(f"- Comments: {post.get('num_comments', 0)}")
    lines.append(f"- Created: {datetime.fromtimestamp(post.get('created_utc', 0)).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append(f"- URL: https://reddit.com{post.get('permalink', '')}")
    lines.append("")

    # Post body
    lines.append("## POST BODY")
    lines.append("-" * 40)
    body = post.get('selftext', '[No text]')
    if body:
        lines.append(body)
    else:
        # Might be a link post
        url = post.get('url', '')
        if url and url != f"https://www.reddit.com{post.get('permalink', '')}":
            lines.append(f"[Link Post]: {url}")
        else:
            lines.append("[No text content]")
    lines.append("")

    # Statistics
    lines.append("## COMMENT STATISTICS")
    lines.append(f"- Total comments extracted: {len(all_comments)}")
    lines.append(f"- Unique authors: {len(set(c['author'] for c in all_comments if c['author'] != '[deleted]'))}")

    op_author = post.get('author', '')
    op_replies = [c for c in all_comments if c['author'] == op_author]
    lines.append(f"- OP replies: {len(op_replies)}")

    delta_comments = [c for c in all_comments if c['has_delta']]
    lines.append(f"- Delta awards: {len(delta_comments)}")

    top_level = [c for c in all_comments if c['depth'] == 0]
    lines.append(f"- Top-level comments: {len(top_level)}")
    lines.append("")

    # Top comments by score
    lines.append("## TOP COMMENTS (by score)")
    lines.append("=" * 80)

    # Sort by score, filter out bots and deleted
    scored_comments = [c for c in all_comments
                       if c['author'] not in ['[deleted]', 'AutoModerator', 'DeltaBot']
                       and c['body'] not in ['[removed]', '[deleted]']]
    scored_comments.sort(key=lambda x: x['score'], reverse=True)

    for i, c in enumerate(scored_comments[:20]):
        lines.append("")
        op_tag = " [OP]" if c['is_op'] else ""
        delta_tag = " [DELTA]" if c['has_delta'] else ""
        depth_indicator = "  " * c['depth'] + (">> " if c['depth'] > 0 else "")

        lines.append(f"### Comment #{i+1} | u/{c['author']}{op_tag}{delta_tag} | Score: {c['score']} | Depth: {c['depth']}")
        lines.append("-" * 40)

        # Truncate very long comments but keep substantial content
        body = c['body']
        if len(body) > 3000:
            lines.append(body[:3000])
            lines.append(f"\n[... truncated, {len(body)} chars total]")
        else:
            lines.append(body)

    # OP's replies section
    if op_replies:
        lines.append("")
        lines.append("## OP'S REPLIES")
        lines.append("=" * 80)

        for i, c in enumerate(op_replies):
            lines.append("")
            lines.append(f"### OP Reply #{i+1} | Score: {c['score']}")
            lines.append("-" * 40)
            body = c['body']
            if len(body) > 2000:
                lines.append(body[:2000])
                lines.append(f"\n[... truncated, {len(body)} chars total]")
            else:
                lines.append(body)

    # Delta awards section (CMV specific)
    if delta_comments:
        lines.append("")
        lines.append("## DELTA AWARDS (View Changes)")
        lines.append("=" * 80)

        for i, c in enumerate(delta_comments):
            lines.append("")
            lines.append(f"### Delta #{i+1} | u/{c['author']} | Score: {c['score']}")
            lines.append("-" * 40)
            lines.append(c['body'][:2000])

    # Thread structure - show comment tree for context
    lines.append("")
    lines.append("## FULL COMMENT TREE (condensed)")
    lines.append("=" * 80)
    lines.append("Format: [score] u/author: first 100 chars...")
    lines.append("")

    for c in all_comments[:100]:  # Limit to first 100 for readability
        if c['author'] in ['[deleted]', 'AutoModerator', 'DeltaBot']:
            continue
        if c['body'] in ['[removed]', '[deleted]']:
            continue

        indent = "  " * c['depth']
        preview = c['body'].replace('\n', ' ')[:100]
        if len(c['body']) > 100:
            preview += "..."

        op_tag = " [OP]" if c['is_op'] else ""
        lines.append(f"{indent}[{c['score']:+d}] u/{c['author']}{op_tag}: {preview}")

    if len(all_comments) > 100:
        lines.append(f"\n[... {len(all_comments) - 100} more comments not shown]")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Download Reddit threads and format for LLM analysis',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s https://www.reddit.com/r/changemyview/comments/1pzzzih/cmv_post_title/
    %(prog)s reddit.com/r/askreddit/comments/abc123/some_post --output my_debate
    %(prog)s https://old.reddit.com/r/pics/comments/xyz789/title/ -o pics_thread
        """
    )
    parser.add_argument('url', help='Reddit post URL (any format)')
    parser.add_argument('-o', '--output', help='Output filename (without extension)', default=None)
    parser.add_argument('--raw', action='store_true', help='Also save raw JSON')
    parser.add_argument('--dir', default='.', help='Output directory (default: current)')

    args = parser.parse_args()

    # Normalize URL
    json_url = normalize_reddit_url(args.url)
    print(f"Fetching: {json_url}")

    # Fetch data
    try:
        data = fetch_reddit_json(json_url)
    except Exception as e:
        print(f"Error fetching data: {e}", file=sys.stderr)
        sys.exit(1)

    # Generate output filename
    if args.output:
        base_name = args.output
    else:
        # Extract from URL: /r/subreddit/comments/id/title/
        match = re.search(r'/r/(\w+)/comments/(\w+)', args.url)
        if match:
            subreddit, post_id = match.groups()
            base_name = f"reddit_{subreddit}_{post_id}"
        else:
            base_name = f"reddit_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    output_dir = Path(args.dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Format for LLM
    formatted = format_for_llm(data)

    # Save formatted output
    formatted_path = output_dir / f"{base_name}.txt"
    with open(formatted_path, 'w', encoding='utf-8') as f:
        f.write(formatted)
    print(f"Saved formatted output: {formatted_path}")

    # Optionally save raw JSON
    if args.raw:
        json_path = output_dir / f"{base_name}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Saved raw JSON: {json_path}")

    # Print summary
    post = data[0]['data']['children'][0]['data']
    print(f"\nThread: {post.get('title', 'N/A')[:60]}...")
    print(f"Score: {post.get('score', 0)} | Comments: {post.get('num_comments', 0)}")
    print(f"\nFormatted output ready for analysis: {formatted_path}")


if __name__ == '__main__':
    main()

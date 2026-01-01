"""
Reddit data fetcher for user comment history and thread context
"""

import json
import time
import ssl
import logging
from typing import Optional, List, Dict, Generator, Tuple
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from collections import defaultdict
from dataclasses import asdict

from models.user_profile import RedditComment, RedditPost, DebateThread

# Try requests library for better SSL handling
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    try:
        import certifi
        SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        SSL_CONTEXT = ssl.create_default_context()
        SSL_CONTEXT.check_hostname = False
        SSL_CONTEXT.verify_mode = ssl.CERT_NONE

logger = logging.getLogger(__name__)


class RedditFetcher:
    """
    Fetches Reddit data for user analysis.

    Handles:
    - User comment history with pagination
    - User post history
    - Full thread context for debates
    - Rate limiting and retries
    """

    BASE_URL = "https://www.reddit.com"
    DEFAULT_USER_AGENT = "ErisDebateAnalyzer/1.0 (Research Tool)"
    RATE_LIMIT_DELAY = 1.0  # seconds between requests

    def __init__(
        self,
        user_agent: Optional[str] = None,
        rate_limit_delay: float = 1.0,
        max_retries: int = 3,
    ):
        self.user_agent = user_agent or self.DEFAULT_USER_AGENT
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Enforce rate limiting between requests"""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self._last_request_time = time.time()

    def _make_request(self, url: str) -> Optional[Dict]:
        """Make HTTP request with retries and error handling"""
        self._rate_limit()

        headers = {"User-Agent": self.user_agent}

        for attempt in range(self.max_retries):
            try:
                if HAS_REQUESTS:
                    response = requests.get(url, headers=headers, timeout=30)
                    response.raise_for_status()
                    return response.json()
                else:
                    request = Request(url, headers=headers)
                    with urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
                        return json.loads(response.read().decode("utf-8"))

            except HTTPError as e:
                if e.code == 429:  # Rate limited
                    wait_time = (attempt + 1) * 5
                    logger.warning(f"Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                elif e.code == 404:
                    logger.warning(f"Not found: {url}")
                    return None
                else:
                    logger.error(f"HTTP error {e.code}: {url}")
                    if attempt == self.max_retries - 1:
                        return None
            except URLError as e:
                logger.error(f"URL error: {e.reason}")
                if attempt == self.max_retries - 1:
                    return None
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                return None
            except Exception as e:
                logger.error(f"Request error: {e}")
                if hasattr(e, "response") and e.response is not None:
                    code = e.response.status_code
                    if code == 429:
                        wait_time = (attempt + 1) * 5
                        logger.warning(f"Rate limited, waiting {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    elif code == 404:
                        logger.warning(f"Not found: {url}")
                        return None
                if attempt == self.max_retries - 1:
                    return None

        return None

    def get_user_comments(
        self,
        username: str,
        limit: int = 500,
        sort: str = "new",
    ) -> Generator[RedditComment, None, None]:
        """
        Fetch user's comment history with pagination.

        Args:
            username: Reddit username (without u/ prefix)
            limit: Maximum comments to fetch (up to 1000)
            sort: Sort order (new, hot, top, controversial)

        Yields:
            RedditComment objects
        """
        after = None
        fetched = 0

        while fetched < limit:
            params = {
                "limit": min(100, limit - fetched),
                "sort": sort,
                "raw_json": 1,
            }
            if after:
                params["after"] = after

            url = f"{self.BASE_URL}/user/{username}/comments.json?{urlencode(params)}"
            logger.info(f"Fetching comments: {url}")

            data = self._make_request(url)
            if not data or "data" not in data:
                break

            children = data["data"].get("children", [])
            if not children:
                break

            for child in children:
                if child.get("kind") != "t1":
                    continue

                c = child["data"]
                yield RedditComment(
                    id=c.get("id", ""),
                    author=c.get("author", ""),
                    body=c.get("body", ""),
                    score=c.get("score", 0),
                    created_utc=c.get("created_utc", 0),
                    parent_id=c.get("parent_id", ""),
                    link_id=c.get("link_id", ""),
                    subreddit=c.get("subreddit", ""),
                    permalink=c.get("permalink", ""),
                    is_submitter=c.get("is_submitter", False),
                )
                fetched += 1

            after = data["data"].get("after")
            if not after:
                break

        logger.info(f"Fetched {fetched} comments for u/{username}")

    def get_user_posts(
        self,
        username: str,
        limit: int = 100,
        sort: str = "new",
    ) -> Generator[RedditPost, None, None]:
        """
        Fetch user's post/submission history with pagination.

        Args:
            username: Reddit username
            limit: Maximum posts to fetch
            sort: Sort order

        Yields:
            RedditPost objects
        """
        after = None
        fetched = 0

        while fetched < limit:
            params = {
                "limit": min(100, limit - fetched),
                "sort": sort,
                "raw_json": 1,
            }
            if after:
                params["after"] = after

            url = f"{self.BASE_URL}/user/{username}/submitted.json?{urlencode(params)}"
            logger.info(f"Fetching posts: {url}")

            data = self._make_request(url)
            if not data or "data" not in data:
                break

            children = data["data"].get("children", [])
            if not children:
                break

            for child in children:
                if child.get("kind") != "t3":
                    continue

                p = child["data"]
                yield RedditPost(
                    id=p.get("id", ""),
                    author=p.get("author", ""),
                    title=p.get("title", ""),
                    selftext=p.get("selftext", ""),
                    score=p.get("score", 0),
                    num_comments=p.get("num_comments", 0),
                    created_utc=p.get("created_utc", 0),
                    subreddit=p.get("subreddit", ""),
                    permalink=p.get("permalink", ""),
                    url=p.get("url", ""),
                )
                fetched += 1

            after = data["data"].get("after")
            if not after:
                break

        logger.info(f"Fetched {fetched} posts for u/{username}")

    def get_thread_context(
        self,
        subreddit: str,
        thread_id: str,
        sort: str = "best",
    ) -> Tuple[Optional[RedditPost], List[RedditComment]]:
        """
        Fetch full thread with all comments for context.

        Args:
            subreddit: Subreddit name
            thread_id: Thread/post ID
            sort: Comment sort order

        Returns:
            Tuple of (post, list of comments)
        """
        url = f"{self.BASE_URL}/r/{subreddit}/comments/{thread_id}.json?sort={sort}&raw_json=1"
        logger.info(f"Fetching thread context: {url}")

        data = self._make_request(url)
        if not data or len(data) < 2:
            return None, []

        # Extract post
        post = None
        post_children = data[0].get("data", {}).get("children", [])
        if post_children and post_children[0].get("kind") == "t3":
            p = post_children[0]["data"]
            post = RedditPost(
                id=p.get("id", ""),
                author=p.get("author", ""),
                title=p.get("title", ""),
                selftext=p.get("selftext", ""),
                score=p.get("score", 0),
                num_comments=p.get("num_comments", 0),
                created_utc=p.get("created_utc", 0),
                subreddit=p.get("subreddit", ""),
                permalink=p.get("permalink", ""),
                url=p.get("url", ""),
            )

        # Extract comments recursively
        def extract_comments(children: List, depth: int = 0) -> List[RedditComment]:
            comments = []
            for child in children:
                if child.get("kind") != "t1":
                    continue

                c = child["data"]
                comment = RedditComment(
                    id=c.get("id", ""),
                    author=c.get("author", "[deleted]"),
                    body=c.get("body", ""),
                    score=c.get("score", 0),
                    created_utc=c.get("created_utc", 0),
                    parent_id=c.get("parent_id", ""),
                    link_id=c.get("link_id", ""),
                    subreddit=c.get("subreddit", ""),
                    permalink=c.get("permalink", ""),
                    depth=depth,
                    is_submitter=c.get("is_submitter", False),
                )
                comments.append(comment)

                # Process nested replies
                replies = c.get("replies")
                if isinstance(replies, dict) and "data" in replies:
                    nested = extract_comments(
                        replies["data"].get("children", []),
                        depth=depth + 1,
                    )
                    comments.extend(nested)

            return comments

        comment_children = data[1].get("data", {}).get("children", [])
        comments = extract_comments(comment_children)

        return post, comments

    def build_debate_threads(
        self,
        username: str,
        comments: List[RedditComment],
        fetch_context: bool = True,
        max_threads: int = 50,
    ) -> List[DebateThread]:
        """
        Group user comments into debate threads and optionally fetch full context.

        Args:
            username: The user being analyzed
            comments: List of user's comments
            fetch_context: Whether to fetch full thread context
            max_threads: Maximum threads to process

        Returns:
            List of DebateThread objects
        """
        username_lower = username.lower()

        # Group comments by thread
        thread_comments: Dict[str, List[RedditComment]] = defaultdict(list)
        thread_subreddits: Dict[str, str] = {}

        for comment in comments:
            thread_id = comment.link_id.replace("t3_", "")
            thread_comments[thread_id].append(comment)
            thread_subreddits[thread_id] = comment.subreddit

        # Build debate threads
        debate_threads = []
        processed = 0

        for thread_id, user_comments in thread_comments.items():
            if processed >= max_threads:
                break

            subreddit = thread_subreddits[thread_id]
            thread_url = f"https://www.reddit.com/r/{subreddit}/comments/{thread_id}"
            thread_title = f"Thread {thread_id}"
            opponent_comments = []

            # Fetch thread context if requested
            if fetch_context:
                post, all_comments = self.get_thread_context(subreddit, thread_id)
                if post:
                    thread_title = post.title
                    thread_url = f"https://www.reddit.com{post.permalink}"

                # Find opponent comments (replies to user or that user replied to)
                user_comment_ids = {f"t1_{c.id}" for c in user_comments}
                comment_map = {f"t1_{c.id}": c for c in all_comments}

                for comment in all_comments:
                    if comment.author.lower() == username_lower:
                        continue
                    # Check if this comment is part of an exchange with the user
                    if comment.parent_id in user_comment_ids:
                        opponent_comments.append(comment)
                    elif f"t1_{comment.id}" in [c.parent_id for c in user_comments]:
                        opponent_comments.append(comment)

            # Check if user is OP
            user_is_op = any(c.is_submitter for c in user_comments)

            debate_thread = DebateThread(
                thread_id=thread_id,
                thread_title=thread_title,
                thread_url=thread_url,
                subreddit=subreddit,
                user_is_op=user_is_op,
                user_comments=user_comments,
                opponent_comments=opponent_comments,
            )
            debate_threads.append(debate_thread)
            processed += 1

        logger.info(f"Built {len(debate_threads)} debate threads for u/{username}")
        return debate_threads

    def fetch_user_data(
        self,
        username: str,
        comment_limit: int = 500,
        fetch_thread_context: bool = True,
        max_threads: int = 50,
    ) -> dict:
        """
        Convenience method to fetch all user data needed for analysis.

        Args:
            username: Reddit username
            comment_limit: Maximum comments to fetch
            fetch_thread_context: Whether to fetch full thread context
            max_threads: Maximum threads to fetch context for

        Returns:
            Dictionary with 'comments' and 'threads' keys
        """
        # Fetch all comments
        comments = list(self.get_user_comments(username, limit=comment_limit))

        if not comments:
            logger.warning(f"No comments found for u/{username}")
            return {"comments": [], "threads": []}

        # Build debate threads
        threads = self.build_debate_threads(
            username=username,
            comments=comments,
            fetch_context=fetch_thread_context,
            max_threads=max_threads,
        )

        return {"comments": comments, "threads": threads}

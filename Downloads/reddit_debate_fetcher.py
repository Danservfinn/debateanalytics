#!/usr/bin/env python3
"""
Reddit Debate Fetcher
=====================
Fetches all threads associated with a given Reddit user and filters for
threads where the user engaged in substantive debates.

Debate Detection Heuristics:
1. Subreddit Classification - Known debate-oriented subreddits weighted higher
2. Exchange Depth - Back-and-forth reply chains indicate debate
3. Response Characteristics - Length, quoting, counterargument language
4. Multi-comment Engagement - Multiple user comments in same thread
5. Adversarial Indicators - Disagreement patterns, rebuttals
6. Delta Awards - CMV-specific indicator of view-changing debate

Usage:
    python reddit_debate_fetcher.py <username> [--min-score 0.5] [--limit 100]
"""

import json
import re
import time
import argparse
import logging
import ssl
import certifi
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, Generator
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from collections import defaultdict
from pathlib import Path

# Try to use requests library if available (handles SSL better)
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    # Create SSL context for urllib fallback
    try:
        SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        # Fallback: unverified context (not recommended but works on macOS)
        SSL_CONTEXT = ssl.create_default_context()
        SSL_CONTEXT.check_hostname = False
        SSL_CONTEXT.verify_mode = ssl.CERT_NONE

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# Configuration & Constants
# =============================================================================

DEBATE_SUBREDDITS = {
    # Tier 1: Explicit debate/discourse subreddits
    'changemyview': 1.0,
    'unpopularopinion': 0.8,
    'tooafraidtoask': 0.6,
    'nostupidquestions': 0.5,
    'explainlikeimfive': 0.4,
    'amitheasshole': 0.7,
    'askreddit': 0.3,

    # Tier 2: Political/ideological debate spaces
    'politics': 0.7,
    'politicaldiscussion': 0.9,
    'neutralpolitics': 0.95,
    'moderatepolitics': 0.85,
    'libertarian': 0.6,
    'conservative': 0.6,
    'liberal': 0.6,
    'socialism': 0.6,
    'capitalismvsocialism': 0.95,

    # Tier 3: Philosophy/ethics
    'philosophy': 0.8,
    'askphilosophy': 0.7,
    'ethics': 0.8,
    'debatereligion': 0.95,
    'atheism': 0.5,

    # Tier 4: Science debate
    'science': 0.4,
    'askscience': 0.5,
    'scientificresearch': 0.5,
}

# Adversarial/debate language indicators
DEBATE_INDICATORS = {
    'disagreement': [
        r'\bi disagree\b', r'\bthat\'s not true\b', r'\bactually,?\b',
        r'\bwrong about\b', r'\bincorrect\b', r'\bfallacy\b',
        r'\bflaw in your\b', r'\bmisunderstand\b', r'\bmisrepresent\b',
        r'\bthat\'s false\b', r'\bnot accurate\b', r'\bcontrary to\b',
    ],
    'rebuttal': [
        r'\bbut\b', r'\bhowever\b', r'\bon the other hand\b',
        r'\bcounterpoint\b', r'\bcounter-argument\b', r'\bin contrast\b',
        r'\balternatively\b', r'\bnevertheless\b', r'\bnonetheless\b',
    ],
    'quoting': [
        r'[>]', r'"[^"]{10,}"', r'you said', r'you claim', r'you argue',
        r'your point', r'your argument', r'you mention', r'you stated',
    ],
    'evidence': [
        r'\bsource[:\s]', r'\bstudy\b', r'\bresearch\b', r'\bdata\b',
        r'\bstatistics\b', r'\baccording to\b', r'\bevidence\b',
        r'\bcitation\b', r'\breference\b',
    ],
    'logical': [
        r'\btherefore\b', r'\bthus\b', r'\bhence\b', r'\bconsequently\b',
        r'\bimplies\b', r'\bif.+then\b', r'\bbecause\b', r'\bsince\b',
        r'\bit follows\b', r'\bpremise\b', r'\bconclusion\b',
    ],
    'concession': [
        r'\bi agree\b', r'\bgood point\b', r'\bfair point\b',
        r'\byou\'re right\b', r'\bi concede\b', r'\bi\'ll grant\b',
        r'\bthat\'s valid\b', r'\bi see your point\b',
    ],
    'delta': [  # CMV specific
        r'[Δ!]delta', r'!delta', r'Δ', r'delta awarded',
    ],
}

# =============================================================================
# Argument Types - Categorize the KIND of arguments being made
# =============================================================================

ARGUMENT_TYPES = {
    'empirical': {
        'description': 'Data-driven, evidence-based arguments',
        'patterns': [
            r'\bstud(?:y|ies)\s+(?:show|found|demonstrate)',
            r'\bresearch\s+(?:shows|indicates|suggests)',
            r'\bdata\s+(?:shows|suggests|indicates)',
            r'\bstatistic(?:s|ally)\b',
            r'\b\d+(?:\.\d+)?%',  # percentages
            r'\baccording to\b',
            r'\bevidence\s+(?:shows|suggests)',
            r'\bpeer[- ]reviewed\b',
            r'\bmeta[- ]analysis\b',
        ],
    },
    'anecdotal': {
        'description': 'Personal experience and stories',
        'patterns': [
            r'\bin my experience\b',
            r'\bi(?:\'ve| have) seen\b',
            r'\bpersonally,?\s+i\b',
            r'\bwhen i was\b',
            r'\bi know someone who\b',
            r'\bmy (?:friend|family|brother|sister|father|mother)\b',
            r'\bi once\b',
            r'\bfrom what i\'ve\b',
            r'\bin my life\b',
            r'\bi grew up\b',
        ],
    },
    'authority': {
        'description': 'Appeals to expert opinion or credentials',
        'patterns': [
            r'\bexperts?\s+(?:say|agree|believe)',
            r'\bscientists?\s+(?:say|agree|believe)',
            r'\bdoctors?\s+(?:say|recommend)',
            r'\bprofessors?\b',
            r'\b(?:as a|i\'m a)\s+\w+(?:ist|er|or)\b',
            r'\baccording to\s+(?:dr\.|professor)',
            r'\bcredentialed\b',
            r'\bqualified\b',
            r'\bprofessional opinion\b',
        ],
    },
    'moral_ethical': {
        'description': 'Appeals to morality, ethics, values',
        'patterns': [
            r'\b(?:morally|ethically)\s+(?:wrong|right)',
            r'\bit\'s (?:wrong|right) to\b',
            r'\bshould(?:n\'t)?\s+be\s+(?:allowed|legal)',
            r'\bhuman rights\b',
            r'\bfundamental(?:ly)?\b',
            r'\bprinciple[sd]?\b',
            r'\bvalues?\b',
            r'\bjustice\b',
            r'\bfairness\b',
            r'\bequality\b',
            r'\bcompassion\b',
        ],
    },
    'logical_deductive': {
        'description': 'Formal logic and deductive reasoning',
        'patterns': [
            r'\bif\s+.+\s+then\b',
            r'\btherefore\b',
            r'\bthus\b',
            r'\bit follows that\b',
            r'\bby definition\b',
            r'\blogically\b',
            r'\bnecessarily\b',
            r'\bimplies\b',
            r'\bpremise\b',
            r'\bconclusion\b',
            r'\bsyllogism\b',
        ],
    },
    'analogical': {
        'description': 'Arguments by analogy or comparison',
        'patterns': [
            r'\bjust like\b',
            r'\bsimilar to\b',
            r'\bsame (?:as|way)\b',
            r'\banalog(?:y|ous)\b',
            r'\bcompare[d]?\s+to\b',
            r'\bequivalent\b',
            r'\blike saying\b',
            r'\bthat\'s like\b',
            r'\bimagine if\b',
            r'\bwhat if\b',
        ],
    },
    'consequentialist': {
        'description': 'Focus on outcomes and consequences',
        'patterns': [
            r'\bconsequences?\b',
            r'\boutcome[s]?\b',
            r'\bresult[s]? in\b',
            r'\blead[s]? to\b',
            r'\bcause[s]?\b',
            r'\beffect[s]?\b',
            r'\bwill happen\b',
            r'\bwould happen\b',
            r'\bif we (?:do|don\'t)\b',
            r'\bslippery slope\b',
        ],
    },
    'definitional': {
        'description': 'Arguments about definitions and meanings',
        'patterns': [
            r'\bby definition\b',
            r'\bdefine[ds]?\b',
            r'\bmeaning of\b',
            r'\bwhat .+ means\b',
            r'\btechnically\b',
            r'\bsemantic\b',
            r'\bliterally\b',
            r'\bthe word\b',
            r'\bdictionary\b',
        ],
    },
    'pragmatic': {
        'description': 'Practical, real-world feasibility arguments',
        'patterns': [
            r'\bpractical(?:ly)?\b',
            r'\bfeasib(?:le|ility)\b',
            r'\brealistic(?:ally)?\b',
            r'\bin practice\b',
            r'\breal world\b',
            r'\bactually works\b',
            r'\bimplementa(?:tion|ble)\b',
            r'\bcost[s]?\b',
            r'\bafford\b',
            r'\bbudget\b',
        ],
    },
    'emotional': {
        'description': 'Appeals to emotion',
        'patterns': [
            r'\bthink of the\b',
            r'\bhow would you feel\b',
            r'\bimagine\b',
            r'\bheartbreaking\b',
            r'\bterrifying\b',
            r'\bdisgusting\b',
            r'\bshocking\b',
            r'\boutrag(?:e|eous|ing)\b',
            r'\bwon\'t someone think of\b',
        ],
    },
}

# =============================================================================
# Logical Fallacies - Common reasoning errors
# =============================================================================

LOGICAL_FALLACIES = {
    'ad_hominem': {
        'description': 'Attacking the person instead of their argument',
        'patterns': [
            r'\byou\'re (?:just |an? )?(?:idiot|moron|stupid|dumb)',
            r'\bpeople like you\b',
            r'\btypical\s+\w+\b',
            r'\bof course you\'d say\b',
            r'\bwhat do you know\b',
            r'\byou\'re clearly\b',
            r'\byou must be\b',
            r'\byour kind\b',
            r'\bgo back to\b',
            r'\bshut up\b',
        ],
    },
    'strawman': {
        'description': 'Misrepresenting the opponent\'s argument',
        'patterns': [
            r'\bso you\'re saying\b',
            r'\bwhat you\'re really saying\b',
            r'\byou think that\b(?!.*\?)',  # not a question
            r'\byou believe\b(?!.*\?)',
            r'\baccording to you\b',
            r'\bby your logic\b',
            r'\bthat\'s like saying\b',
            r'\bso basically\b',
        ],
    },
    'false_dichotomy': {
        'description': 'Presenting only two options when more exist',
        'patterns': [
            r'\beither\s+.+\s+or\b',
            r'\bit\'s (?:either|one or the other)\b',
            r'\byou\'re either\b',
            r'\bthere(?:\'s| are) only two\b',
            r'\bno middle ground\b',
            r'\bpick a side\b',
            r'\bwith us or against\b',
            r'\bblack and white\b',
        ],
    },
    'appeal_to_nature': {
        'description': 'Assuming natural = good, unnatural = bad',
        'patterns': [
            r'\bnatural(?:ly)?\s+(?:is |means )?(?:better|good|healthy)',
            r'\bunnatural\b',
            r'\bchemicals?\b.*\bbad\b',
            r'\bprocessed\b.*\bbad\b',
            r'\borganic\s+(?:is |means )?(?:better|healthier)',
            r'\bnature intended\b',
            r'\bhow nature\b',
        ],
    },
    'slippery_slope': {
        'description': 'Assuming one thing inevitably leads to extreme consequences',
        'patterns': [
            r'\bnext thing you know\b',
            r'\bwhere does it end\b',
            r'\bslippery slope\b',
            r'\bopen the door to\b',
            r'\bfloodgates\b',
            r'\bwhat\'s next\b',
            r'\bsoon (?:they\'ll|we\'ll|you\'ll)\b',
            r'\bbefore you know it\b',
            r'\blead(?:s)? to\b.*\blead(?:s)? to\b',
        ],
    },
    'appeal_to_popularity': {
        'description': 'Assuming popular = correct',
        'patterns': [
            r'\beveryone knows\b',
            r'\bmost people\b',
            r'\bmajority\s+(?:thinks?|believes?)',
            r'\bcommon (?:knowledge|sense)\b',
            r'\bobviously\b',
            r'\bno one (?:thinks|believes)\b',
            r'\bmillions of people\b',
            r'\bpopular opinion\b',
        ],
    },
    'false_equivalence': {
        'description': 'Treating different things as if they\'re the same',
        'patterns': [
            r'\bboth sides\b',
            r'\bjust as bad\b',
            r'\bsame thing\b',
            r'\bno different\b',
            r'\bequally\s+(?:bad|wrong|guilty)',
            r'\bwhat about\b',
            r'\bbut they\b',
            r'\bhypocrit\b',
        ],
    },
    'moving_goalposts': {
        'description': 'Changing the criteria when the original argument is met',
        'patterns': [
            r'\bthat doesn\'t count\b',
            r'\bthat\'s different\b',
            r'\byes,? but\b',
            r'\bstill doesn\'t\b',
            r'\bwhat about\b',
            r'\beven if\b.*\bstill\b',
            r'\bbesides\b',
            r'\banyway\b',
        ],
    },
    'no_true_scotsman': {
        'description': 'Dismissing counterexamples by redefining the group',
        'patterns': [
            r'\breal\s+\w+\s+(?:don\'t|wouldn\'t|would never)',
            r'\btrue\s+\w+\s+(?:don\'t|wouldn\'t)',
            r'\bnot a (?:real|true)\b',
            r'\bthey\'re not really\b',
            r'\bdoesn\'t represent\b',
        ],
    },
    'tu_quoque': {
        'description': 'Deflecting criticism by pointing to opponent\'s behavior',
        'patterns': [
            r'\byou do it too\b',
            r'\bwhat about when you\b',
            r'\blook who\'s talking\b',
            r'\byou\'re one to talk\b',
            r'\bhypocrit\b',
            r'\bpot calling\b',
            r'\bbut you\b',
        ],
    },
    'appeal_to_emotion': {
        'description': 'Substituting emotional appeal for logical argument',
        'patterns': [
            r'\bthink of the children\b',
            r'\bhow would you feel if\b',
            r'\bput yourself in\b',
            r'\bhow can you\b',
            r'\bdon\'t you care\b',
            r'\bhave a heart\b',
            r'\bheartless\b',
            r'\bmonster\b',
        ],
    },
    'burden_of_proof': {
        'description': 'Shifting burden of proof to the wrong party',
        'patterns': [
            r'\bprove (?:me|it) wrong\b',
            r'\bcan\'t (?:prove|disprove)\b',
            r'\buntil you (?:prove|show)\b',
            r'\bwhere\'s your (?:evidence|proof)\b',
            r'\byou can\'t prove\b',
            r'\babsence of (?:evidence|proof)\b',
        ],
    },
    'circular_reasoning': {
        'description': 'Using the conclusion as a premise',
        'patterns': [
            r'\bbecause it is\b',
            r'\bit\'s true because\b.*\btrue\b',
            r'\bby definition\b.*\btherefore\b',
            r'\bthe bible says\b.*\btrue\b.*\bbible\b',
        ],
    },
    'hasty_generalization': {
        'description': 'Drawing broad conclusions from limited examples',
        'patterns': [
            r'\ball\s+\w+\s+(?:are|do|have)\b',
            r'\bnone of them\b',
            r'\bthey always\b',
            r'\bthey never\b',
            r'\beveryone\s+(?:in|from|who)\b',
            r'\bno one ever\b',
            r'\bevery single\b',
        ],
    },
}

# Compile all patterns
COMPILED_PATTERNS = {
    category: [re.compile(p, re.IGNORECASE) for p in patterns]
    for category, patterns in DEBATE_INDICATORS.items()
}

COMPILED_ARG_TYPES = {
    arg_type: [re.compile(p, re.IGNORECASE) for p in data['patterns']]
    for arg_type, data in ARGUMENT_TYPES.items()
}

COMPILED_FALLACIES = {
    fallacy: [re.compile(p, re.IGNORECASE) for p in data['patterns']]
    for fallacy, data in LOGICAL_FALLACIES.items()
}


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class RedditComment:
    """Represents a Reddit comment with debate-relevant metadata."""
    id: str
    author: str
    body: str
    score: int
    created_utc: float
    parent_id: str
    link_id: str
    subreddit: str
    permalink: str
    depth: int = 0
    replies: list = field(default_factory=list)

    @property
    def is_reply_to_comment(self) -> bool:
        return self.parent_id.startswith('t1_')

    @property
    def word_count(self) -> int:
        return len(self.body.split())

    @property
    def created_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.created_utc)


@dataclass
class RedditPost:
    """Represents a Reddit post/submission."""
    id: str
    author: str
    title: str
    selftext: str
    score: int
    num_comments: int
    created_utc: float
    subreddit: str
    permalink: str
    url: str

    @property
    def word_count(self) -> int:
        return len(self.selftext.split()) if self.selftext else 0

    @property
    def created_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.created_utc)


@dataclass
class DebateThread:
    """Represents a thread where the user may have engaged in debate."""
    thread_id: str
    thread_title: str
    thread_url: str
    subreddit: str
    user_is_op: bool
    user_comments: list  # List of RedditComment
    exchange_partners: dict  # {username: [comments]}
    debate_score: float = 0.0
    debate_indicators: dict = field(default_factory=dict)

    @property
    def user_comment_count(self) -> int:
        return len(self.user_comments)

    @property
    def max_exchange_depth(self) -> int:
        return max((c.depth for c in self.user_comments), default=0)

    @property
    def total_words(self) -> int:
        return sum(c.word_count for c in self.user_comments)


# =============================================================================
# Reddit API Client
# =============================================================================

class RedditClient:
    """Handles Reddit JSON API requests with rate limiting."""

    BASE_URL = "https://www.reddit.com"
    USER_AGENT = "DebateFetcher/1.0 (Research Tool)"
    RATE_LIMIT_DELAY = 1.0  # seconds between requests

    def __init__(self):
        self._last_request_time = 0

    def _rate_limit(self):
        """Enforce rate limiting between requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()

    def _make_request(self, url: str, retries: int = 3) -> Optional[dict]:
        """Make HTTP request with retries and error handling."""
        self._rate_limit()

        headers = {'User-Agent': self.USER_AGENT}

        for attempt in range(retries):
            try:
                if HAS_REQUESTS:
                    # Use requests library (better SSL handling)
                    response = requests.get(url, headers=headers, timeout=30)
                    response.raise_for_status()
                    return response.json()
                else:
                    # Fallback to urllib with SSL context
                    request = Request(url, headers=headers)
                    with urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
                        return json.loads(response.read().decode('utf-8'))

            except HTTPError as e:
                code = e.code
                if code == 429:  # Rate limited
                    wait_time = (attempt + 1) * 5
                    logger.warning(f"Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                elif code == 404:
                    logger.warning(f"Not found: {url}")
                    return None
                else:
                    logger.error(f"HTTP error {code}: {url}")
                    if attempt == retries - 1:
                        return None
            except URLError as e:
                logger.error(f"URL error: {e.reason}")
                if attempt == retries - 1:
                    return None
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                return None
            except Exception as e:
                # Catch requests exceptions and other errors
                err_msg = str(e)
                if hasattr(e, 'response') and e.response is not None:
                    code = e.response.status_code
                    if code == 429:
                        wait_time = (attempt + 1) * 5
                        logger.warning(f"Rate limited, waiting {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    elif code == 404:
                        logger.warning(f"Not found: {url}")
                        return None
                    else:
                        logger.error(f"HTTP error {code}: {url}")
                else:
                    logger.error(f"Request error: {err_msg}")
                if attempt == retries - 1:
                    return None

        return None

    def get_user_comments(
        self,
        username: str,
        limit: int = 100,
        sort: str = 'new'
    ) -> Generator[RedditComment, None, None]:
        """Fetch user's comment history with pagination."""
        after = None
        fetched = 0

        while fetched < limit:
            params = {
                'limit': min(100, limit - fetched),
                'sort': sort,
                'raw_json': 1,
            }
            if after:
                params['after'] = after

            url = f"{self.BASE_URL}/user/{username}/comments.json?{urlencode(params)}"
            logger.info(f"Fetching comments: {url}")

            data = self._make_request(url)
            if not data or 'data' not in data:
                break

            children = data['data'].get('children', [])
            if not children:
                break

            for child in children:
                if child.get('kind') != 't1':
                    continue

                comment_data = child['data']
                yield RedditComment(
                    id=comment_data['id'],
                    author=comment_data['author'],
                    body=comment_data.get('body', ''),
                    score=comment_data.get('score', 0),
                    created_utc=comment_data.get('created_utc', 0),
                    parent_id=comment_data.get('parent_id', ''),
                    link_id=comment_data.get('link_id', ''),
                    subreddit=comment_data.get('subreddit', ''),
                    permalink=comment_data.get('permalink', ''),
                )
                fetched += 1

            after = data['data'].get('after')
            if not after:
                break

        logger.info(f"Fetched {fetched} comments for u/{username}")

    def get_user_posts(
        self,
        username: str,
        limit: int = 100,
        sort: str = 'new'
    ) -> Generator[RedditPost, None, None]:
        """Fetch user's post/submission history with pagination."""
        after = None
        fetched = 0

        while fetched < limit:
            params = {
                'limit': min(100, limit - fetched),
                'sort': sort,
                'raw_json': 1,
            }
            if after:
                params['after'] = after

            url = f"{self.BASE_URL}/user/{username}/submitted.json?{urlencode(params)}"
            logger.info(f"Fetching posts: {url}")

            data = self._make_request(url)
            if not data or 'data' not in data:
                break

            children = data['data'].get('children', [])
            if not children:
                break

            for child in children:
                if child.get('kind') != 't3':
                    continue

                post_data = child['data']
                yield RedditPost(
                    id=post_data['id'],
                    author=post_data['author'],
                    title=post_data.get('title', ''),
                    selftext=post_data.get('selftext', ''),
                    score=post_data.get('score', 0),
                    num_comments=post_data.get('num_comments', 0),
                    created_utc=post_data.get('created_utc', 0),
                    subreddit=post_data.get('subreddit', ''),
                    permalink=post_data.get('permalink', ''),
                    url=post_data.get('url', ''),
                )
                fetched += 1

            after = data['data'].get('after')
            if not after:
                break

        logger.info(f"Fetched {fetched} posts for u/{username}")

    def get_thread_comments(
        self,
        subreddit: str,
        thread_id: str,
        sort: str = 'best'
    ) -> tuple[Optional[RedditPost], list[RedditComment]]:
        """Fetch full thread with all comments."""
        url = f"{self.BASE_URL}/r/{subreddit}/comments/{thread_id}.json?sort={sort}&raw_json=1"
        logger.info(f"Fetching thread: {url}")

        data = self._make_request(url)
        if not data or len(data) < 2:
            return None, []

        # Extract post
        post = None
        post_children = data[0].get('data', {}).get('children', [])
        if post_children and post_children[0].get('kind') == 't3':
            p = post_children[0]['data']
            post = RedditPost(
                id=p['id'],
                author=p['author'],
                title=p.get('title', ''),
                selftext=p.get('selftext', ''),
                score=p.get('score', 0),
                num_comments=p.get('num_comments', 0),
                created_utc=p.get('created_utc', 0),
                subreddit=p.get('subreddit', ''),
                permalink=p.get('permalink', ''),
                url=p.get('url', ''),
            )

        # Extract comments recursively
        def extract_comments(children: list, depth: int = 0) -> list[RedditComment]:
            comments = []
            for child in children:
                if child.get('kind') != 't1':
                    continue

                c = child['data']
                comment = RedditComment(
                    id=c['id'],
                    author=c.get('author', '[deleted]'),
                    body=c.get('body', ''),
                    score=c.get('score', 0),
                    created_utc=c.get('created_utc', 0),
                    parent_id=c.get('parent_id', ''),
                    link_id=c.get('link_id', ''),
                    subreddit=c.get('subreddit', ''),
                    permalink=c.get('permalink', ''),
                    depth=depth,
                )
                comments.append(comment)

                # Process nested replies
                replies = c.get('replies')
                if isinstance(replies, dict) and 'data' in replies:
                    nested = extract_comments(
                        replies['data'].get('children', []),
                        depth=depth + 1
                    )
                    comment.replies = nested
                    comments.extend(nested)

            return comments

        comment_children = data[1].get('data', {}).get('children', [])
        comments = extract_comments(comment_children)

        return post, comments


# =============================================================================
# Debate Analysis Engine
# =============================================================================

class DebateAnalyzer:
    """Analyzes user activity to identify debate engagement."""

    def __init__(self, username: str, client: RedditClient):
        self.username = username.lower()
        self.client = client

    def analyze_comment_for_debate(self, comment: RedditComment) -> dict:
        """Score a single comment for debate indicators."""
        scores = {}
        body_lower = comment.body.lower()

        for category, patterns in COMPILED_PATTERNS.items():
            matches = sum(1 for p in patterns if p.search(body_lower))
            scores[category] = min(matches / len(patterns), 1.0)  # Normalize 0-1

        return scores

    def analyze_argument_types(self, comment: RedditComment) -> dict:
        """Identify types of arguments used in a comment."""
        results = {}
        body = comment.body

        for arg_type, patterns in COMPILED_ARG_TYPES.items():
            matches = []
            for p in patterns:
                found = p.findall(body)
                matches.extend(found)
            results[arg_type] = {
                'count': len(matches),
                'matches': matches[:3],  # Keep first 3 examples
            }

        return results

    def analyze_fallacies(self, comment: RedditComment) -> dict:
        """Detect potential logical fallacies in a comment."""
        results = {}
        body = comment.body

        for fallacy, patterns in COMPILED_FALLACIES.items():
            matches = []
            for p in patterns:
                found = p.findall(body)
                matches.extend(found)
            if matches:
                results[fallacy] = {
                    'count': len(matches),
                    'matches': matches[:3],  # Keep first 3 examples
                    'description': LOGICAL_FALLACIES[fallacy]['description'],
                }

        return results

    def analyze_user_rhetoric(self, comments: list) -> dict:
        """Aggregate rhetorical analysis across all user comments."""
        arg_type_totals = defaultdict(int)
        fallacy_totals = defaultdict(lambda: {'count': 0, 'examples': []})

        for comment in comments:
            # Analyze argument types
            arg_analysis = self.analyze_argument_types(comment)
            for arg_type, data in arg_analysis.items():
                arg_type_totals[arg_type] += data['count']

            # Analyze fallacies
            fallacy_analysis = self.analyze_fallacies(comment)
            for fallacy, data in fallacy_analysis.items():
                fallacy_totals[fallacy]['count'] += data['count']
                if len(fallacy_totals[fallacy]['examples']) < 3:
                    fallacy_totals[fallacy]['examples'].extend(data['matches'][:2])
                fallacy_totals[fallacy]['description'] = data['description']

        return {
            'argument_types': dict(arg_type_totals),
            'fallacies': dict(fallacy_totals),
            'total_comments': len(comments),
        }

    def calculate_subreddit_weight(self, subreddit: str) -> float:
        """Get debate weight for a subreddit."""
        return DEBATE_SUBREDDITS.get(subreddit.lower(), 0.2)

    def find_exchange_partners(
        self,
        user_comments: list[RedditComment],
        all_comments: list[RedditComment]
    ) -> dict:
        """Find users who exchanged replies with target user."""
        # Map comment ID to comment
        comment_map = {f"t1_{c.id}": c for c in all_comments}

        # Find who the user replied to and who replied to user
        partners = defaultdict(list)
        user_comment_ids = {f"t1_{c.id}" for c in user_comments}

        for comment in user_comments:
            # Who did user reply to?
            if comment.parent_id in comment_map:
                parent = comment_map[comment.parent_id]
                if parent.author.lower() != self.username:
                    partners[parent.author].append({
                        'type': 'user_replied_to',
                        'comment': comment,
                        'parent': parent,
                    })

        # Who replied to user?
        for comment in all_comments:
            if comment.author.lower() == self.username:
                continue
            if comment.parent_id in user_comment_ids:
                partners[comment.author].append({
                    'type': 'replied_to_user',
                    'comment': comment,
                })

        return dict(partners)

    def score_debate_thread(self, thread: DebateThread) -> float:
        """Calculate comprehensive debate score for a thread."""
        scores = []
        weights = []

        # 1. Subreddit weight (0-1)
        sub_weight = self.calculate_subreddit_weight(thread.subreddit)
        scores.append(sub_weight)
        weights.append(2.0)  # High importance

        # 2. User comment count in thread (normalized)
        comment_score = min(thread.user_comment_count / 5, 1.0)  # Cap at 5+ comments
        scores.append(comment_score)
        weights.append(1.5)

        # 3. Exchange depth (back-and-forth indicator)
        depth_score = min(thread.max_exchange_depth / 4, 1.0)  # Cap at depth 4+
        scores.append(depth_score)
        weights.append(2.0)

        # 4. Total words (substantive engagement)
        word_score = min(thread.total_words / 500, 1.0)  # Cap at 500+ words
        scores.append(word_score)
        weights.append(1.0)

        # 5. Number of exchange partners
        partner_count = len(thread.exchange_partners)
        partner_score = min(partner_count / 3, 1.0)  # Cap at 3+ partners
        scores.append(partner_score)
        weights.append(1.5)

        # 6. Aggregate debate indicators from comments
        if thread.debate_indicators:
            for category, cat_score in thread.debate_indicators.items():
                scores.append(cat_score)
                # Weight certain categories higher
                if category in ('disagreement', 'rebuttal', 'delta'):
                    weights.append(2.0)
                elif category in ('evidence', 'logical'):
                    weights.append(1.5)
                else:
                    weights.append(1.0)

        # Calculate weighted average
        if not scores:
            return 0.0

        weighted_sum = sum(s * w for s, w in zip(scores, weights))
        total_weight = sum(weights)

        return weighted_sum / total_weight

    def analyze_user_threads(
        self,
        comment_limit: int = 500,
        post_limit: int = 100,
        fetch_thread_context: bool = True,
    ) -> list[DebateThread]:
        """Analyze all user activity and identify debate threads."""

        # Group comments by thread
        thread_comments = defaultdict(list)
        thread_subreddits = {}

        logger.info(f"Fetching comments for u/{self.username}...")
        for comment in self.client.get_user_comments(self.username, limit=comment_limit):
            thread_id = comment.link_id.replace('t3_', '')
            thread_comments[thread_id].append(comment)
            thread_subreddits[thread_id] = comment.subreddit

        # Track threads where user is OP
        user_posts = {}
        logger.info(f"Fetching posts for u/{self.username}...")
        for post in self.client.get_user_posts(self.username, limit=post_limit):
            user_posts[post.id] = post

        # Analyze each thread
        debate_threads = []

        for thread_id, user_comments in thread_comments.items():
            subreddit = thread_subreddits[thread_id]

            # Get thread context if requested
            all_comments = []
            thread_title = f"Thread {thread_id}"
            thread_url = f"https://www.reddit.com/r/{subreddit}/comments/{thread_id}"

            if fetch_thread_context:
                post, all_comments = self.client.get_thread_comments(subreddit, thread_id)
                if post:
                    thread_title = post.title
                    thread_url = f"https://www.reddit.com{post.permalink}"

            # Find exchange partners
            exchange_partners = self.find_exchange_partners(user_comments, all_comments)

            # Calculate aggregate debate indicators
            all_indicators = defaultdict(list)
            for comment in user_comments:
                indicators = self.analyze_comment_for_debate(comment)
                for cat, score in indicators.items():
                    all_indicators[cat].append(score)

            # Average the indicators
            avg_indicators = {
                cat: sum(scores) / len(scores)
                for cat, scores in all_indicators.items()
            }

            # Build debate thread object
            debate_thread = DebateThread(
                thread_id=thread_id,
                thread_title=thread_title,
                thread_url=thread_url,
                subreddit=subreddit,
                user_is_op=thread_id in user_posts,
                user_comments=user_comments,
                exchange_partners=exchange_partners,
                debate_indicators=avg_indicators,
            )

            # Score it
            debate_thread.debate_score = self.score_debate_thread(debate_thread)
            debate_threads.append(debate_thread)

        # Sort by debate score descending
        debate_threads.sort(key=lambda t: t.debate_score, reverse=True)

        return debate_threads


# =============================================================================
# Output Formatters
# =============================================================================

def format_thread_summary(thread: DebateThread) -> str:
    """Format a single thread for console output."""
    lines = [
        f"\n{'='*80}",
        f"DEBATE SCORE: {thread.debate_score:.3f}",
        f"{'='*80}",
        f"Thread: {thread.thread_title[:70]}{'...' if len(thread.thread_title) > 70 else ''}",
        f"Subreddit: r/{thread.subreddit}",
        f"URL: {thread.thread_url}",
        f"User is OP: {'Yes' if thread.user_is_op else 'No'}",
        f"User Comments: {thread.user_comment_count}",
        f"Total Words: {thread.total_words}",
        f"Max Depth: {thread.max_exchange_depth}",
        f"Exchange Partners: {len(thread.exchange_partners)}",
    ]

    if thread.exchange_partners:
        lines.append(f"Partners: {', '.join(list(thread.exchange_partners.keys())[:5])}")

    # Top debate indicators
    if thread.debate_indicators:
        top_indicators = sorted(
            thread.debate_indicators.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        if top_indicators:
            indicator_str = ', '.join(f"{k}:{v:.2f}" for k, v in top_indicators)
            lines.append(f"Top Indicators: {indicator_str}")

    return '\n'.join(lines)


def export_to_json(
    threads: list[DebateThread],
    username: str,
    output_path: Path,
    rhetoric_analysis: dict = None
) -> None:
    """Export debate threads to JSON."""

    def thread_to_dict(t: DebateThread) -> dict:
        return {
            'thread_id': t.thread_id,
            'thread_title': t.thread_title,
            'thread_url': t.thread_url,
            'subreddit': t.subreddit,
            'user_is_op': t.user_is_op,
            'debate_score': round(t.debate_score, 4),
            'user_comment_count': t.user_comment_count,
            'total_words': t.total_words,
            'max_depth': t.max_exchange_depth,
            'exchange_partner_count': len(t.exchange_partners),
            'exchange_partners': list(t.exchange_partners.keys()),
            'debate_indicators': {
                k: round(v, 4) for k, v in t.debate_indicators.items()
            },
            'user_comments': [
                {
                    'id': c.id,
                    'body': c.body,
                    'score': c.score,
                    'depth': c.depth,
                    'word_count': c.word_count,
                    'created_utc': c.created_utc,
                    'permalink': c.permalink,
                }
                for c in t.user_comments
            ],
        }

    export_data = {
        'username': username,
        'fetched_at': datetime.now().isoformat(),
        'total_threads': len(threads),
        'debate_threads': [thread_to_dict(t) for t in threads],
    }

    # Add rhetoric analysis if available
    if rhetoric_analysis:
        export_data['rhetoric_analysis'] = {
            'argument_types': rhetoric_analysis.get('argument_types', {}),
            'fallacies': {
                k: {'count': v['count'], 'description': v.get('description', '')}
                for k, v in rhetoric_analysis.get('fallacies', {}).items()
            },
            'total_comments_analyzed': rhetoric_analysis.get('total_comments', 0),
        }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Exported {len(threads)} threads to {output_path}")


def print_rhetoric_analysis(rhetoric: dict, username: str) -> None:
    """Print formatted rhetoric analysis."""
    print(f"\n{'='*80}")
    print(f"RHETORICAL ANALYSIS: u/{username}")
    print(f"{'='*80}")

    # Argument Types
    arg_types = rhetoric.get('argument_types', {})
    if arg_types:
        print(f"\n📊 ARGUMENT TYPES (by frequency)")
        sorted_args = sorted(arg_types.items(), key=lambda x: x[1], reverse=True)
        total = sum(arg_types.values())
        for arg_type, count in sorted_args:
            if count > 0:
                pct = 100 * count / total if total > 0 else 0
                bar = "█" * int(pct / 2)
                desc = ARGUMENT_TYPES.get(arg_type, {}).get('description', '')
                print(f"   {arg_type:20} {count:4} ({pct:5.1f}%) {bar}")
                if desc:
                    print(f"   {'':20} └─ {desc}")

    # Fallacies
    fallacies = rhetoric.get('fallacies', {})
    if fallacies:
        print(f"\n⚠️  LOGICAL FALLACIES DETECTED")
        sorted_fallacies = sorted(fallacies.items(), key=lambda x: x[1]['count'], reverse=True)
        for fallacy, data in sorted_fallacies:
            count = data['count']
            desc = data.get('description', LOGICAL_FALLACIES.get(fallacy, {}).get('description', ''))
            print(f"   {fallacy:25} {count:3}x")
            print(f"   {'':25} └─ {desc}")
            examples = data.get('examples', [])
            if examples:
                for ex in examples[:2]:
                    ex_str = str(ex)[:50]
                    print(f"   {'':25}    \"{ex_str}...\"")
    else:
        print(f"\n✅ NO OBVIOUS LOGICAL FALLACIES DETECTED")

    # Summary
    total_args = sum(arg_types.values())
    total_fallacies = sum(f['count'] for f in fallacies.values())
    fallacy_rate = total_fallacies / total_args * 100 if total_args > 0 else 0

    print(f"\n📈 SUMMARY")
    print(f"   Total argument markers: {total_args}")
    print(f"   Total fallacy markers:  {total_fallacies}")
    print(f"   Fallacy rate:           {fallacy_rate:.1f}%")

    # Determine primary argument style
    if arg_types:
        top_arg = max(arg_types.items(), key=lambda x: x[1])
        print(f"   Primary style:          {top_arg[0]}")

    # Determine biggest weakness
    if fallacies:
        top_fallacy = max(fallacies.items(), key=lambda x: x[1]['count'])
        print(f"   Most common fallacy:    {top_fallacy[0]}")


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Fetch Reddit user activity and identify debate threads.'
    )
    parser.add_argument(
        'username',
        help='Reddit username to analyze (without u/ prefix)'
    )
    parser.add_argument(
        '--min-score',
        type=float,
        default=0.05,
        help='Minimum debate score threshold (0-1, default: 0.05)'
    )
    parser.add_argument(
        '--comment-limit',
        type=int,
        default=500,
        help='Maximum comments to fetch (default: 500)'
    )
    parser.add_argument(
        '--post-limit',
        type=int,
        default=100,
        help='Maximum posts to fetch (default: 100)'
    )
    parser.add_argument(
        '--no-context',
        action='store_true',
        help='Skip fetching full thread context (faster but less accurate)'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output JSON file path (default: {username}_debates.json)'
    )
    parser.add_argument(
        '--top',
        type=int,
        default=20,
        help='Show top N debate threads (default: 20)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    username = args.username.lstrip('u/')

    print(f"\n{'='*80}")
    print(f"REDDIT DEBATE FETCHER")
    print(f"Analyzing user: u/{username}")
    print(f"{'='*80}\n")

    # Initialize client and analyzer
    client = RedditClient()
    analyzer = DebateAnalyzer(username, client)

    # Analyze threads
    threads = analyzer.analyze_user_threads(
        comment_limit=args.comment_limit,
        post_limit=args.post_limit,
        fetch_thread_context=not args.no_context,
    )

    if not threads:
        print(f"\nNo threads found for u/{username}")
        return

    # Filter by minimum score
    debate_threads = [t for t in threads if t.debate_score >= args.min_score]

    print(f"\n{'='*80}")
    print(f"RESULTS SUMMARY")
    print(f"{'='*80}")
    print(f"Total threads analyzed: {len(threads)}")
    print(f"Threads meeting debate threshold (>={args.min_score}): {len(debate_threads)}")

    # Show top debate threads
    print(f"\nTop {min(args.top, len(debate_threads))} Debate Threads:")
    for thread in debate_threads[:args.top]:
        print(format_thread_summary(thread))

    # Collect all comments for rhetoric analysis
    all_user_comments = []
    for t in debate_threads:
        all_user_comments.extend(t.user_comments)

    # Perform rhetoric analysis
    rhetoric_analysis = None
    if all_user_comments:
        rhetoric_analysis = analyzer.analyze_user_rhetoric(all_user_comments)
        print_rhetoric_analysis(rhetoric_analysis, username)

    # Export to JSON
    output_path = Path(args.output) if args.output else Path(f"{username}_debates.json")
    export_to_json(debate_threads, username, output_path, rhetoric_analysis)

    # Summary statistics
    if debate_threads:
        avg_score = sum(t.debate_score for t in debate_threads) / len(debate_threads)
        top_subreddits = defaultdict(int)
        for t in debate_threads:
            top_subreddits[t.subreddit] += 1

        print(f"\n{'='*80}")
        print(f"STATISTICS")
        print(f"{'='*80}")
        print(f"Average debate score: {avg_score:.3f}")
        print(f"Most active debate subreddits:")
        for sub, count in sorted(top_subreddits.items(), key=lambda x: -x[1])[:5]:
            print(f"  r/{sub}: {count} threads")


if __name__ == '__main__':
    main()

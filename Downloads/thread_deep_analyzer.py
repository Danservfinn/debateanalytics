#!/usr/bin/env python3
"""
Thread Deep Analyzer
====================
Sophisticated single-thread debate analysis powered by Claude.

Produces comprehensive analysis including:
- Debate topology mapping
- Participant battle cards
- Argument clash analysis
- Evidence citation network
- Fallacy detection with full context
- Sentiment/civility timeline
- Key moments identification
- Verdict determination
- Synthesis report

Usage:
    python thread_deep_analyzer.py <thread_url> [--api-key KEY]
"""

import json
import re
import os
import sys
import time
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional
from pathlib import Path

# Try to import anthropic for Claude API
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    print("Warning: anthropic package not installed. Install with: pip install anthropic")

# Try requests for Reddit fetching
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    import urllib.request
    import ssl
    try:
        import certifi
        SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
    except:
        SSL_CONTEXT = ssl.create_default_context()
        SSL_CONTEXT.check_hostname = False
        SSL_CONTEXT.verify_mode = ssl.CERT_NONE


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class Comment:
    """Single Reddit comment."""
    id: str
    author: str
    body: str
    score: int
    created_utc: float
    parent_id: str
    depth: int
    permalink: str
    replies: list = field(default_factory=list)
    is_op: bool = False


@dataclass
class ThreadStructure:
    """Thread topology analysis."""
    total_comments: int
    max_depth: int
    branch_count: int
    substantive_branches: int
    tangent_branches: int
    average_comment_length: int
    total_words: int


@dataclass
class Participant:
    """Participant performance in this thread."""
    username: str
    role: str  # op, primary_challenger, supporter, etc.
    comment_count: int
    total_words: int
    first_comment_time: float
    last_comment_time: float
    engaged_with: list

    # Performance scores (0-100)
    argument_quality: int = 0
    evidence_usage: int = 0
    rebuttal_effectiveness: int = 0
    civility: int = 0
    influence: int = 0
    overall_score: int = 0

    # Analysis
    key_contributions: list = field(default_factory=list)
    techniques_used: list = field(default_factory=list)
    fallacies_committed: list = field(default_factory=list)
    clashes_won: int = 0
    clashes_lost: int = 0
    clashes_draw: int = 0
    badges: list = field(default_factory=list)


@dataclass
class Argument:
    """Extracted argument/claim."""
    argument_id: str
    author: str
    comment_id: str
    claim: str
    argument_type: str
    evidence_provided: Optional[dict]
    confidence_level: str
    was_addressed: bool
    outcome: str  # unaddressed, supported, refuted, inconclusive
    responses: list = field(default_factory=list)


@dataclass
class Clash:
    """Direct disagreement between participants."""
    clash_id: str
    topic: str
    side_a: dict
    side_b: dict
    winner: Optional[str]
    winner_confidence: float
    determining_factors: list
    resolution_type: str  # clear_winner, draw, unresolved, mutual_understanding
    impact_on_debate: str


@dataclass
class Evidence:
    """Piece of evidence cited in the debate."""
    evidence_id: str
    introduced_by: str
    comment_id: str
    source: str
    source_type: str  # academic, industry_research, news, anecdote, statistic
    source_url: Optional[str]
    quality_score: int
    times_cited: int
    cited_by: list
    was_challenged: bool
    challenge_outcome: Optional[str]
    impact: str


@dataclass
class FallacyInstance:
    """Detected logical fallacy with full context."""
    fallacy_id: str
    fallacy_type: str
    committed_by: str
    victim: Optional[str]
    confidence: float
    severity: str  # minor, moderate, significant, severe

    # The crime scene
    user_statement: str
    user_statement_context: str
    opponent_actual_statement: Optional[str]
    explanation: str

    # Consequences
    immediate_response: str
    debate_impact: str
    credibility_impact: str

    comment_id: str
    comment_url: str
    timestamp: float


@dataclass
class KeyMoment:
    """Pivotal moment in the debate."""
    moment_rank: int
    moment_type: str  # opening, paradigm_shift, heated_exchange, concession, resolution
    timestamp: float
    participant: str
    description: str
    significance: str
    before_state: str
    after_state: str
    comment_id: str
    quote: Optional[str]


@dataclass
class SentimentPoint:
    """Sentiment at a point in time."""
    timestamp: float
    civility_score: int
    sentiment: str
    notable_event: Optional[str]
    comment_id: Optional[str]


@dataclass
class Verdict:
    """Overall debate verdict."""
    outcome_type: str  # clear_winner, narrow_winner, draw, unresolved, collaborative
    winner: Optional[str]
    loser: Optional[str]
    confidence: float

    # Scoring breakdown
    scoring_breakdown: dict

    # Victory factors
    victory_factors: list
    decisive_moment: dict

    # Loser analysis
    loser_what_went_wrong: list
    loser_what_they_did_well: list
    loser_could_have_won_if: list


@dataclass
class ThreadAnalysis:
    """Complete thread analysis."""
    # Metadata
    thread_id: str
    thread_url: str
    thread_title: str
    subreddit: str
    op_username: str
    created_at: float
    analyzed_at: float

    # Structure
    structure: ThreadStructure

    # Participants
    participants: list  # List of Participant
    participant_count: int

    # Arguments
    arguments: list  # List of Argument
    argument_chains: list

    # Clashes
    clashes: list  # List of Clash

    # Evidence
    evidence_inventory: list  # List of Evidence

    # Fallacies
    fallacies: list  # List of FallacyInstance
    fallacy_summary: dict

    # Sentiment
    sentiment_timeline: list  # List of SentimentPoint
    overall_civility: int

    # Key moments
    key_moments: list  # List of KeyMoment

    # Verdict
    verdict: Verdict

    # Executive summary
    executive_summary: dict
    narrative_summary: str

    # Quality metrics
    thread_quality_grade: str  # A, B, C, D, F
    thread_quality_score: int

    # Unfinished business
    unaddressed_arguments: list
    unresolved_disagreements: list
    unanswered_questions: list
    future_debate_topics: list


# =============================================================================
# Reddit Thread Fetcher
# =============================================================================

class RedditThreadFetcher:
    """Fetches complete Reddit threads."""

    USER_AGENT = "ThreadDeepAnalyzer/1.0"

    def __init__(self):
        self.last_request_time = 0
        self.rate_limit_delay = 1.0

    def _rate_limit(self):
        """Ensure we don't exceed rate limits."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self.last_request_time = time.time()

    def _fetch_url(self, url: str) -> dict:
        """Fetch JSON from URL."""
        self._rate_limit()

        if HAS_REQUESTS:
            headers = {'User-Agent': self.USER_AGENT}
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
        else:
            req = urllib.request.Request(url, headers={'User-Agent': self.USER_AGENT})
            with urllib.request.urlopen(req, context=SSL_CONTEXT, timeout=30) as resp:
                return json.loads(resp.read().decode('utf-8'))

    def fetch_thread(self, thread_url: str) -> tuple:
        """
        Fetch a complete Reddit thread.

        Returns:
            (post_data, comments_tree, all_comments_flat)
        """
        # Normalize URL
        if not thread_url.endswith('.json'):
            thread_url = thread_url.rstrip('/') + '.json'

        # Ensure we get all comments
        if '?' in thread_url:
            thread_url += '&limit=500'
        else:
            thread_url += '?limit=500'

        data = self._fetch_url(thread_url)

        if not isinstance(data, list) or len(data) < 2:
            raise ValueError("Invalid thread data structure")

        # Extract post data
        post_listing = data[0]
        post_data = post_listing['data']['children'][0]['data']

        # Extract comments
        comments_listing = data[1]
        comments_tree = self._parse_comments(comments_listing['data']['children'])

        # Flatten for easy iteration
        all_comments = self._flatten_comments(comments_tree)

        return post_data, comments_tree, all_comments

    def _parse_comments(self, children: list, depth: int = 0) -> list:
        """Recursively parse comment tree."""
        comments = []

        for child in children:
            if child['kind'] != 't1':
                continue

            data = child['data']

            # Skip deleted/removed
            if data.get('author') in ['[deleted]', '[removed]']:
                continue

            comment = Comment(
                id=data['id'],
                author=data.get('author', '[unknown]'),
                body=data.get('body', ''),
                score=data.get('score', 0),
                created_utc=data.get('created_utc', 0),
                parent_id=data.get('parent_id', ''),
                depth=depth,
                permalink=f"https://reddit.com{data.get('permalink', '')}",
                replies=[],
                is_op=False
            )

            # Parse replies
            replies_data = data.get('replies')
            if replies_data and isinstance(replies_data, dict):
                reply_children = replies_data.get('data', {}).get('children', [])
                comment.replies = self._parse_comments(reply_children, depth + 1)

            comments.append(comment)

        return comments

    def _flatten_comments(self, comments: list) -> list:
        """Flatten comment tree to list."""
        flat = []
        for comment in comments:
            flat.append(comment)
            if comment.replies:
                flat.extend(self._flatten_comments(comment.replies))
        return flat


# =============================================================================
# Claude Analysis Engine
# =============================================================================

class ClaudeAnalyzer:
    """Claude-powered debate analysis."""

    def __init__(self, api_key: Optional[str] = None):
        if not HAS_ANTHROPIC:
            raise ImportError("anthropic package required. Install with: pip install anthropic")

        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("Anthropic API key required. Set ANTHROPIC_API_KEY or pass api_key.")

        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = "claude-sonnet-4-20250514"

    def _call_claude(self, system: str, prompt: str, max_tokens: int = 8000) -> str:
        """Make a Claude API call."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text

    def _extract_json(self, text: str) -> dict:
        """Extract JSON from Claude's response."""
        # Try to find JSON block
        json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find raw JSON
        try:
            # Find first { and last }
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

        return {}

    def analyze_structure_and_participants(self, post: dict, comments: list) -> dict:
        """Analyze thread structure and extract participants."""

        system = """You are an expert at analyzing Reddit debate threads.
You identify thread structure, participant roles, and debate dynamics.
Always respond with valid JSON."""

        # Build thread summary for Claude
        thread_summary = self._build_thread_summary(post, comments)

        prompt = f"""Analyze this Reddit thread structure and participants.

## Thread Data
{thread_summary}

## Task
1. Analyze the thread structure (depth, branching, substantive vs tangent branches)
2. Identify all participants and their roles
3. Map who engaged with whom
4. Identify the main debate lines vs. side discussions

## Output Format
Return JSON:
```json
{{
  "structure": {{
    "total_comments": <int>,
    "max_depth": <int>,
    "branch_count": <int>,
    "substantive_branches": <int>,
    "tangent_branches": <int>,
    "average_comment_length": <int>,
    "total_words": <int>,
    "structure_description": "<brief description of thread shape>"
  }},
  "participants": [
    {{
      "username": "<username>",
      "role": "<op|primary_challenger|supporter|devil_advocate|mediator|tangent>",
      "comment_count": <int>,
      "total_words": <int>,
      "engaged_with": ["<usernames>"],
      "position_summary": "<what position do they hold in the debate>",
      "contribution_summary": "<brief summary of their contribution>"
    }}
  ],
  "main_debate_branches": [
    {{
      "branch_id": <int>,
      "participants": ["<usernames>"],
      "topic": "<what is being debated>",
      "depth": <int>,
      "is_resolved": <bool>
    }}
  ]
}}
```"""

        response = self._call_claude(system, prompt)
        return self._extract_json(response)

    def extract_arguments_and_clashes(self, post: dict, comments: list) -> dict:
        """Extract all arguments and identify clashes."""

        system = """You are an expert rhetoric analyst. You identify arguments, claims,
evidence, and points of disagreement in debates. Always respond with valid JSON."""

        thread_summary = self._build_thread_summary(post, comments)

        prompt = f"""Extract all arguments and clashes from this debate thread.

## Thread Data
{thread_summary}

## Task
1. Extract every distinct argument/claim made
2. Identify what evidence (if any) supports each claim
3. Map claim-response relationships
4. Identify "clashes" - direct disagreements between participants
5. For each clash, analyze who presented the stronger case

## Output Format
Return JSON:
```json
{{
  "arguments": [
    {{
      "argument_id": "arg_001",
      "author": "<username>",
      "comment_id": "<id>",
      "claim": "<the claim being made>",
      "argument_type": "<empirical|anecdotal|authority|logical|moral|consequentialist|definitional>",
      "evidence_provided": {{
        "has_evidence": <bool>,
        "source": "<source if cited>",
        "source_type": "<academic|industry|news|anecdote|statistic|none>",
        "quality": "<high|medium|low|none>"
      }},
      "responses": ["<argument_ids that respond to this>"],
      "was_addressed": <bool>,
      "outcome": "<unaddressed|supported|refuted|inconclusive>"
    }}
  ],
  "clashes": [
    {{
      "clash_id": "clash_001",
      "topic": "<what is being disputed>",
      "side_a": {{
        "author": "<username>",
        "position": "<their position>",
        "argument_quality": <0-100>,
        "evidence_quality": <0-100>,
        "key_strengths": ["<strengths>"],
        "key_weaknesses": ["<weaknesses>"]
      }},
      "side_b": {{
        "author": "<username>",
        "position": "<their position>",
        "argument_quality": <0-100>,
        "evidence_quality": <0-100>,
        "key_strengths": ["<strengths>"],
        "key_weaknesses": ["<weaknesses>"]
      }},
      "winner": "<username or null if draw>",
      "winner_confidence": <0.0-1.0>,
      "determining_factors": ["<what decided it>"],
      "resolution_type": "<clear_winner|narrow_winner|draw|unresolved>",
      "impact_on_debate": "<how this clash affected overall debate>"
    }}
  ],
  "evidence_inventory": [
    {{
      "evidence_id": "ev_001",
      "introduced_by": "<username>",
      "source": "<source name>",
      "source_type": "<type>",
      "quality_score": <0-100>,
      "times_cited": <int>,
      "was_challenged": <bool>,
      "impact": "<how this evidence affected the debate>"
    }}
  ]
}}
```"""

        response = self._call_claude(system, prompt)
        return self._extract_json(response)

    def detect_fallacies(self, post: dict, comments: list) -> dict:
        """Detect logical fallacies with full context."""

        system = """You are an expert in logic and critical thinking. You identify logical
fallacies with precision, providing full context and avoiding false positives.
Only flag clear fallacies with high confidence. Always respond with valid JSON."""

        thread_summary = self._build_thread_summary(post, comments)

        prompt = f"""Detect logical fallacies in this debate thread.

## Thread Data
{thread_summary}

## Task
For each fallacy detected:
1. Identify the fallacy type
2. Quote the exact statement
3. Provide full context (what were they responding to?)
4. Explain why it's a fallacy
5. Assess the impact on the debate

Only report fallacies with confidence >= 0.75. Avoid false positives.

## Fallacy Types to Check
- ad_hominem: Attacking person instead of argument
- strawman: Misrepresenting opponent's position
- false_dichotomy: Presenting only two options when more exist
- appeal_to_popularity: Claiming truth because many believe it
- slippery_slope: Claiming inevitable extreme outcomes
- hasty_generalization: Broad conclusions from limited examples
- moving_goalposts: Changing criteria after rebuttal
- circular_reasoning: Conclusion assumed in premise
- appeal_to_authority: Citing authority without valid reasoning
- whataboutism: Deflecting to opponent's behavior
- red_herring: Introducing irrelevant topics
- false_equivalence: Equating unlike things

## Output Format
Return JSON:
```json
{{
  "fallacy_summary": {{
    "total_fallacies": <int>,
    "by_participant": {{"<username>": <count>}},
    "thread_fallacy_rate": <float>,
    "cleanest_debater": "<username with fewest/no fallacies>",
    "most_fallacious": "<username with most fallacies>"
  }},
  "fallacies": [
    {{
      "fallacy_id": "fal_001",
      "fallacy_type": "<type>",
      "committed_by": "<username>",
      "victim": "<username who was strawmanned/attacked, if applicable>",
      "confidence": <0.75-1.0>,
      "severity": "<minor|moderate|significant|severe>",
      "user_statement": "<exact quote of fallacious statement>",
      "user_statement_context": "<what were they responding to>",
      "opponent_actual_statement": "<what opponent actually said, for strawman>",
      "explanation": "<clear explanation of why this is a fallacy>",
      "immediate_response": "<how did others respond>",
      "debate_impact": "<how did this affect the debate>",
      "credibility_impact": "<how did this affect their credibility>",
      "comment_id": "<id>",
      "timestamp": <unix timestamp if available>
    }}
  ]
}}
```"""

        response = self._call_claude(system, prompt)
        return self._extract_json(response)

    def analyze_sentiment_and_key_moments(self, post: dict, comments: list) -> dict:
        """Analyze sentiment trajectory and identify key moments."""

        system = """You are an expert at analyzing debate dynamics, emotional trajectory,
and identifying pivotal moments. Always respond with valid JSON."""

        thread_summary = self._build_thread_summary(post, comments)

        prompt = f"""Analyze the sentiment trajectory and key moments in this debate.

## Thread Data
{thread_summary}

## Task
1. Track how civility and sentiment evolved over the debate
2. Identify escalation and de-escalation points
3. Find the 5-8 most pivotal moments that shaped the debate
4. Assess overall debate quality

## Output Format
Return JSON:
```json
{{
  "overall_sentiment": {{
    "average_civility": <0-100>,
    "average_sentiment": "<constructive|neutral|tense|hostile>",
    "tension_level": "<low|moderate|high>",
    "trajectory": "<improving|stable|declining|volatile>"
  }},
  "sentiment_timeline": [
    {{
      "period": "<time range or comment range>",
      "civility_score": <0-100>,
      "sentiment": "<description>",
      "notable_event": "<what happened here, if anything>"
    }}
  ],
  "escalation_events": [
    {{
      "trigger": "<what caused escalation>",
      "participants": ["<usernames>"],
      "severity": "<minor|moderate|significant>",
      "recovery_time": "<how long until civility recovered>"
    }}
  ],
  "participant_civility": {{
    "<username>": <0-100>
  }},
  "key_moments": [
    {{
      "moment_rank": <1-8>,
      "moment_type": "<opening|paradigm_shift|heated_exchange|key_evidence|concession|resolution>",
      "participant": "<username>",
      "description": "<what happened>",
      "significance": "<why this mattered>",
      "before_state": "<state of debate before>",
      "after_state": "<state of debate after>",
      "comment_id": "<id>",
      "quote": "<key quote if applicable>"
    }}
  ]
}}
```"""

        response = self._call_claude(system, prompt)
        return self._extract_json(response)

    def generate_verdict_and_synthesis(self, post: dict, comments: list,
                                        prior_analyses: dict) -> dict:
        """Generate final verdict and synthesize all analyses."""

        system = """You are an expert debate judge and analyst. You synthesize multiple
analyses into a coherent verdict and narrative summary. Be fair, evidence-based,
and acknowledge uncertainty. Always respond with valid JSON."""

        thread_summary = self._build_thread_summary(post, comments)

        prompt = f"""Generate the final verdict and synthesis for this debate.

## Thread Data
{thread_summary}

## Prior Analyses
{json.dumps(prior_analyses, indent=2)}

## Task
1. Determine the overall debate outcome (who won, or if it was a draw)
2. Explain the victory factors with weights
3. Identify the single most decisive moment
4. Analyze what the loser could have done differently
5. Generate an executive summary
6. Write a narrative summary of the debate
7. Assess overall thread quality
8. Identify unfinished business

## Output Format
Return JSON:
```json
{{
  "verdict": {{
    "outcome_type": "<clear_winner|narrow_winner|draw|unresolved|collaborative>",
    "winner": "<username or null>",
    "loser": "<username or null>",
    "confidence": <0.0-1.0>,
    "scoring_breakdown": {{
      "argument_quality": {{"winner": "<username>", "margin": "<description>"}},
      "evidence_strength": {{"winner": "<username>", "margin": "<description>"}},
      "rebuttal_success": {{"winner": "<username>", "margin": "<description>"}},
      "peer_validation": {{"winner": "<username>", "description": "<description>"}}
    }},
    "victory_factors": [
      {{
        "factor": "<name>",
        "weight": <0.0-1.0>,
        "explanation": "<why this mattered>",
        "specific_moment": "<when this was demonstrated>"
      }}
    ],
    "decisive_moment": {{
      "description": "<what happened>",
      "participant": "<username>",
      "why_decisive": "<explanation>"
    }},
    "loser_postmortem": {{
      "what_went_wrong": ["<issues>"],
      "what_they_did_well": ["<positives>"],
      "could_have_won_if": ["<alternative strategies>"]
    }}
  }},
  "executive_summary": {{
    "one_liner": "<one sentence summary>",
    "outcome": "<brief outcome>",
    "quality_grade": "<A|B|C|D|F>",
    "key_insight": "<main takeaway>"
  }},
  "narrative_summary": "<2-3 paragraph narrative of what happened in this debate>",
  "thread_quality": {{
    "grade": "<A|B|C|D|F>",
    "score": <0-100>,
    "what_made_it_good": ["<positives>"],
    "what_could_be_better": ["<issues>"]
  }},
  "unfinished_business": {{
    "unaddressed_arguments": [
      {{
        "argument": "<the argument>",
        "raised_by": "<username>",
        "should_have_been_addressed_by": "<username>",
        "importance": "<high|medium|low>"
      }}
    ],
    "unresolved_disagreements": [
      {{
        "topic": "<topic>",
        "party_a": {{"user": "<username>", "position": "<position>"}},
        "party_b": {{"user": "<username>", "position": "<position>"}},
        "could_be_resolved_by": "<suggestion>"
      }}
    ],
    "unanswered_questions": ["<questions>"],
    "future_debate_topics": ["<topics>"]
  }},
  "participant_rankings": [
    {{
      "rank": <int>,
      "username": "<username>",
      "overall_score": <0-100>,
      "key_contributions": ["<contributions>"],
      "areas_for_improvement": ["<areas>"],
      "badges": ["<MVP|Evidence_King|Mind_Changer|Most_Civil|etc>"]
    }}
  ]
}}
```"""

        response = self._call_claude(system, prompt, max_tokens=12000)
        return self._extract_json(response)

    def _build_thread_summary(self, post: dict, comments: list, max_comments: int = 100) -> str:
        """Build a text summary of the thread for Claude."""

        lines = []

        # Post info
        lines.append(f"## Original Post")
        lines.append(f"Title: {post.get('title', 'Unknown')}")
        lines.append(f"Author: u/{post.get('author', 'Unknown')} (OP)")
        lines.append(f"Subreddit: r/{post.get('subreddit', 'Unknown')}")
        lines.append(f"Score: {post.get('score', 0)}")
        lines.append(f"")
        lines.append(f"Body:")
        lines.append(post.get('selftext', '[No body]')[:2000])
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## Comments")
        lines.append("")

        # Comments (limited)
        op_author = post.get('author', '')
        for i, comment in enumerate(comments[:max_comments]):
            is_op = "(OP)" if comment.author == op_author else ""
            indent = "  " * comment.depth
            lines.append(f"{indent}[{comment.id}] u/{comment.author} {is_op} (score: {comment.score}, depth: {comment.depth})")
            lines.append(f"{indent}> {comment.body[:500]}{'...' if len(comment.body) > 500 else ''}")
            lines.append("")

        if len(comments) > max_comments:
            lines.append(f"... and {len(comments) - max_comments} more comments")

        return "\n".join(lines)


# =============================================================================
# Main Analyzer Class
# =============================================================================

class ThreadDeepAnalyzer:
    """Complete thread analysis orchestrator."""

    def __init__(self, api_key: Optional[str] = None):
        self.fetcher = RedditThreadFetcher()
        self.claude = ClaudeAnalyzer(api_key) if HAS_ANTHROPIC else None
        self.cache_dir = Path("thread_analysis_cache")
        self.cache_dir.mkdir(exist_ok=True)

    def analyze_thread(self, thread_url: str, use_cache: bool = True) -> ThreadAnalysis:
        """
        Perform complete analysis of a Reddit thread.

        Args:
            thread_url: URL of the Reddit thread
            use_cache: Whether to use cached analysis if available

        Returns:
            Complete ThreadAnalysis object
        """
        # Check cache
        cache_key = hashlib.md5(thread_url.encode()).hexdigest()
        cache_file = self.cache_dir / f"{cache_key}.json"

        if use_cache and cache_file.exists():
            print(f"Loading cached analysis...")
            with open(cache_file, 'r') as f:
                return self._dict_to_analysis(json.load(f))

        print(f"Fetching thread: {thread_url}")
        post, comments_tree, all_comments = self.fetcher.fetch_thread(thread_url)

        print(f"Found {len(all_comments)} comments")

        # Mark OP comments
        op_author = post.get('author', '')
        for comment in all_comments:
            comment.is_op = (comment.author == op_author)

        if not self.claude:
            print("Claude API not available. Performing basic analysis only.")
            return self._basic_analysis(post, all_comments, thread_url)

        print("Running Claude analysis pipeline...")

        # Stage 1: Structure and Participants
        print("  [1/4] Analyzing structure and participants...")
        structure_result = self.claude.analyze_structure_and_participants(post, all_comments)

        # Stage 2: Arguments and Clashes
        print("  [2/4] Extracting arguments and clashes...")
        arguments_result = self.claude.extract_arguments_and_clashes(post, all_comments)

        # Stage 3: Fallacies
        print("  [3/4] Detecting fallacies...")
        fallacies_result = self.claude.detect_fallacies(post, all_comments)

        # Stage 4: Sentiment and Key Moments
        print("  [4/4] Analyzing sentiment and key moments...")
        sentiment_result = self.claude.analyze_sentiment_and_key_moments(post, all_comments)

        # Final Synthesis
        print("  [5/4] Generating verdict and synthesis...")
        prior_analyses = {
            'structure': structure_result,
            'arguments': arguments_result,
            'fallacies': fallacies_result,
            'sentiment': sentiment_result
        }
        synthesis_result = self.claude.generate_verdict_and_synthesis(post, all_comments, prior_analyses)

        # Build final analysis object
        analysis = self._build_analysis(
            post, all_comments, thread_url,
            structure_result, arguments_result, fallacies_result,
            sentiment_result, synthesis_result
        )

        # Cache result
        with open(cache_file, 'w') as f:
            json.dump(self._analysis_to_dict(analysis), f, indent=2)

        print("Analysis complete!")
        return analysis

    def _basic_analysis(self, post: dict, comments: list, thread_url: str) -> ThreadAnalysis:
        """Perform basic analysis without Claude."""

        # Calculate basic stats
        total_words = sum(len(c.body.split()) for c in comments)
        max_depth = max((c.depth for c in comments), default=0)

        # Extract participants
        participants_dict = {}
        for c in comments:
            if c.author not in participants_dict:
                participants_dict[c.author] = {
                    'comment_count': 0,
                    'total_words': 0,
                    'first_time': c.created_utc,
                    'last_time': c.created_utc
                }
            p = participants_dict[c.author]
            p['comment_count'] += 1
            p['total_words'] += len(c.body.split())
            p['last_time'] = max(p['last_time'], c.created_utc)

        participants = []
        for username, stats in participants_dict.items():
            role = 'op' if username == post.get('author') else 'participant'
            participants.append(Participant(
                username=username,
                role=role,
                comment_count=stats['comment_count'],
                total_words=stats['total_words'],
                first_comment_time=stats['first_time'],
                last_comment_time=stats['last_time'],
                engaged_with=[]
            ))

        structure = ThreadStructure(
            total_comments=len(comments),
            max_depth=max_depth,
            branch_count=len([c for c in comments if c.depth == 1]),
            substantive_branches=0,
            tangent_branches=0,
            average_comment_length=total_words // len(comments) if comments else 0,
            total_words=total_words
        )

        verdict = Verdict(
            outcome_type='unanalyzed',
            winner=None,
            loser=None,
            confidence=0,
            scoring_breakdown={},
            victory_factors=[],
            decisive_moment={},
            loser_what_went_wrong=[],
            loser_what_they_did_well=[],
            loser_could_have_won_if=[]
        )

        return ThreadAnalysis(
            thread_id=post.get('id', ''),
            thread_url=thread_url,
            thread_title=post.get('title', ''),
            subreddit=post.get('subreddit', ''),
            op_username=post.get('author', ''),
            created_at=post.get('created_utc', 0),
            analyzed_at=time.time(),
            structure=structure,
            participants=participants,
            participant_count=len(participants),
            arguments=[],
            argument_chains=[],
            clashes=[],
            evidence_inventory=[],
            fallacies=[],
            fallacy_summary={},
            sentiment_timeline=[],
            overall_civility=0,
            key_moments=[],
            verdict=verdict,
            executive_summary={'note': 'Claude API required for full analysis'},
            narrative_summary='Claude API required for narrative summary.',
            thread_quality_grade='N/A',
            thread_quality_score=0,
            unaddressed_arguments=[],
            unresolved_disagreements=[],
            unanswered_questions=[],
            future_debate_topics=[]
        )

    def _build_analysis(self, post: dict, comments: list, thread_url: str,
                        structure_result: dict, arguments_result: dict,
                        fallacies_result: dict, sentiment_result: dict,
                        synthesis_result: dict) -> ThreadAnalysis:
        """Build complete analysis from Claude results."""

        # Structure
        struct_data = structure_result.get('structure', {})
        structure = ThreadStructure(
            total_comments=struct_data.get('total_comments', len(comments)),
            max_depth=struct_data.get('max_depth', 0),
            branch_count=struct_data.get('branch_count', 0),
            substantive_branches=struct_data.get('substantive_branches', 0),
            tangent_branches=struct_data.get('tangent_branches', 0),
            average_comment_length=struct_data.get('average_comment_length', 0),
            total_words=struct_data.get('total_words', 0)
        )

        # Participants
        participants = []
        rankings = synthesis_result.get('participant_rankings', [])
        ranking_map = {r['username']: r for r in rankings}

        for p_data in structure_result.get('participants', []):
            username = p_data.get('username', '')
            ranking = ranking_map.get(username, {})

            participants.append(Participant(
                username=username,
                role=p_data.get('role', 'participant'),
                comment_count=p_data.get('comment_count', 0),
                total_words=p_data.get('total_words', 0),
                first_comment_time=0,
                last_comment_time=0,
                engaged_with=p_data.get('engaged_with', []),
                overall_score=ranking.get('overall_score', 0),
                key_contributions=ranking.get('key_contributions', []),
                badges=ranking.get('badges', [])
            ))

        # Fallacies
        fallacy_summary = fallacies_result.get('fallacy_summary', {})

        # Verdict
        verdict_data = synthesis_result.get('verdict', {})
        verdict = Verdict(
            outcome_type=verdict_data.get('outcome_type', 'unknown'),
            winner=verdict_data.get('winner'),
            loser=verdict_data.get('loser'),
            confidence=verdict_data.get('confidence', 0),
            scoring_breakdown=verdict_data.get('scoring_breakdown', {}),
            victory_factors=verdict_data.get('victory_factors', []),
            decisive_moment=verdict_data.get('decisive_moment', {}),
            loser_what_went_wrong=verdict_data.get('loser_postmortem', {}).get('what_went_wrong', []),
            loser_what_they_did_well=verdict_data.get('loser_postmortem', {}).get('what_they_did_well', []),
            loser_could_have_won_if=verdict_data.get('loser_postmortem', {}).get('could_have_won_if', [])
        )

        # Unfinished business
        unfinished = synthesis_result.get('unfinished_business', {})

        # Executive summary
        exec_summary = synthesis_result.get('executive_summary', {})

        # Thread quality
        thread_quality = synthesis_result.get('thread_quality', {})

        return ThreadAnalysis(
            thread_id=post.get('id', ''),
            thread_url=thread_url,
            thread_title=post.get('title', ''),
            subreddit=post.get('subreddit', ''),
            op_username=post.get('author', ''),
            created_at=post.get('created_utc', 0),
            analyzed_at=time.time(),
            structure=structure,
            participants=participants,
            participant_count=len(participants),
            arguments=arguments_result.get('arguments', []),
            argument_chains=[],
            clashes=arguments_result.get('clashes', []),
            evidence_inventory=arguments_result.get('evidence_inventory', []),
            fallacies=fallacies_result.get('fallacies', []),
            fallacy_summary=fallacy_summary,
            sentiment_timeline=sentiment_result.get('sentiment_timeline', []),
            overall_civility=sentiment_result.get('overall_sentiment', {}).get('average_civility', 0),
            key_moments=sentiment_result.get('key_moments', []),
            verdict=verdict,
            executive_summary=exec_summary,
            narrative_summary=synthesis_result.get('narrative_summary', ''),
            thread_quality_grade=thread_quality.get('grade', 'N/A'),
            thread_quality_score=thread_quality.get('score', 0),
            unaddressed_arguments=unfinished.get('unaddressed_arguments', []),
            unresolved_disagreements=unfinished.get('unresolved_disagreements', []),
            unanswered_questions=unfinished.get('unanswered_questions', []),
            future_debate_topics=unfinished.get('future_debate_topics', [])
        )

    def _analysis_to_dict(self, analysis: ThreadAnalysis) -> dict:
        """Convert analysis to JSON-serializable dict."""
        result = {
            'thread_id': analysis.thread_id,
            'thread_url': analysis.thread_url,
            'thread_title': analysis.thread_title,
            'subreddit': analysis.subreddit,
            'op_username': analysis.op_username,
            'created_at': analysis.created_at,
            'analyzed_at': analysis.analyzed_at,
            'structure': asdict(analysis.structure),
            'participants': [asdict(p) for p in analysis.participants],
            'participant_count': analysis.participant_count,
            'arguments': analysis.arguments,
            'argument_chains': analysis.argument_chains,
            'clashes': analysis.clashes,
            'evidence_inventory': analysis.evidence_inventory,
            'fallacies': analysis.fallacies,
            'fallacy_summary': analysis.fallacy_summary,
            'sentiment_timeline': analysis.sentiment_timeline,
            'overall_civility': analysis.overall_civility,
            'key_moments': analysis.key_moments,
            'verdict': asdict(analysis.verdict),
            'executive_summary': analysis.executive_summary,
            'narrative_summary': analysis.narrative_summary,
            'thread_quality_grade': analysis.thread_quality_grade,
            'thread_quality_score': analysis.thread_quality_score,
            'unaddressed_arguments': analysis.unaddressed_arguments,
            'unresolved_disagreements': analysis.unresolved_disagreements,
            'unanswered_questions': analysis.unanswered_questions,
            'future_debate_topics': analysis.future_debate_topics
        }
        return result

    def _dict_to_analysis(self, data: dict) -> ThreadAnalysis:
        """Convert dict back to ThreadAnalysis."""
        structure = ThreadStructure(**data['structure'])
        participants = [Participant(**p) for p in data['participants']]
        verdict = Verdict(**data['verdict'])

        return ThreadAnalysis(
            thread_id=data['thread_id'],
            thread_url=data['thread_url'],
            thread_title=data['thread_title'],
            subreddit=data['subreddit'],
            op_username=data['op_username'],
            created_at=data['created_at'],
            analyzed_at=data['analyzed_at'],
            structure=structure,
            participants=participants,
            participant_count=data['participant_count'],
            arguments=data['arguments'],
            argument_chains=data['argument_chains'],
            clashes=data['clashes'],
            evidence_inventory=data['evidence_inventory'],
            fallacies=data['fallacies'],
            fallacy_summary=data['fallacy_summary'],
            sentiment_timeline=data['sentiment_timeline'],
            overall_civility=data['overall_civility'],
            key_moments=data['key_moments'],
            verdict=verdict,
            executive_summary=data['executive_summary'],
            narrative_summary=data['narrative_summary'],
            thread_quality_grade=data['thread_quality_grade'],
            thread_quality_score=data['thread_quality_score'],
            unaddressed_arguments=data['unaddressed_arguments'],
            unresolved_disagreements=data['unresolved_disagreements'],
            unanswered_questions=data['unanswered_questions'],
            future_debate_topics=data['future_debate_topics']
        )

    def print_analysis(self, analysis: ThreadAnalysis):
        """Print formatted analysis to console."""

        print("\n" + "=" * 70)
        print("🎯 THREAD ANALYSIS REPORT")
        print("=" * 70)

        # Header
        print(f"\n📌 {analysis.thread_title}")
        print(f"   r/{analysis.subreddit} • u/{analysis.op_username}")
        print(f"   {analysis.thread_url}")

        # Executive Summary
        if analysis.executive_summary:
            print(f"\n📋 EXECUTIVE SUMMARY")
            print("-" * 40)
            if 'one_liner' in analysis.executive_summary:
                print(f"   {analysis.executive_summary['one_liner']}")
            if 'quality_grade' in analysis.executive_summary:
                print(f"   Grade: {analysis.executive_summary['quality_grade']}")

        # Structure Stats
        print(f"\n📊 THREAD STRUCTURE")
        print("-" * 40)
        s = analysis.structure
        print(f"   Comments: {s.total_comments}")
        print(f"   Max Depth: {s.max_depth}")
        print(f"   Branches: {s.branch_count} ({s.substantive_branches} substantive)")
        print(f"   Total Words: {s.total_words}")

        # Participants
        print(f"\n👥 PARTICIPANTS ({analysis.participant_count})")
        print("-" * 40)
        for p in sorted(analysis.participants, key=lambda x: x.overall_score, reverse=True)[:5]:
            badges = " ".join([f"🏆{b}" for b in p.badges[:2]]) if p.badges else ""
            print(f"   u/{p.username} [{p.role}] - Score: {p.overall_score} {badges}")
            print(f"      {p.comment_count} comments, {p.total_words} words")

        # Verdict
        v = analysis.verdict
        print(f"\n⚖️ VERDICT")
        print("-" * 40)
        print(f"   Outcome: {v.outcome_type}")
        if v.winner:
            print(f"   Winner: u/{v.winner} (confidence: {v.confidence:.0%})")
        if v.loser:
            print(f"   Loser: u/{v.loser}")

        if v.victory_factors:
            print(f"\n   Victory Factors:")
            for factor in v.victory_factors[:3]:
                if isinstance(factor, dict):
                    print(f"     • {factor.get('factor', 'Unknown')}: {factor.get('explanation', '')[:60]}")

        if v.decisive_moment and isinstance(v.decisive_moment, dict):
            print(f"\n   Decisive Moment:")
            print(f"     {v.decisive_moment.get('description', 'Unknown')[:80]}")

        # Key Moments
        if analysis.key_moments:
            print(f"\n🎯 KEY MOMENTS")
            print("-" * 40)
            for m in analysis.key_moments[:5]:
                if isinstance(m, dict):
                    print(f"   [{m.get('moment_type', '')}] {m.get('description', '')[:60]}")

        # Fallacies
        if analysis.fallacy_summary:
            print(f"\n⚠️ FALLACY REPORT")
            print("-" * 40)
            print(f"   Total Detected: {analysis.fallacy_summary.get('total_fallacies', 0)}")
            if analysis.fallacy_summary.get('cleanest_debater'):
                print(f"   Cleanest Debater: u/{analysis.fallacy_summary['cleanest_debater']}")

        # Clashes
        if analysis.clashes:
            print(f"\n⚔️ MAJOR CLASHES ({len(analysis.clashes)})")
            print("-" * 40)
            for clash in analysis.clashes[:3]:
                if isinstance(clash, dict):
                    winner = clash.get('winner', 'Draw')
                    print(f"   • {clash.get('topic', 'Unknown')[:40]}")
                    print(f"     Winner: {winner if winner else 'Draw'}")

        # Unfinished Business
        if analysis.unaddressed_arguments or analysis.unanswered_questions:
            print(f"\n🔮 UNFINISHED BUSINESS")
            print("-" * 40)
            if analysis.unaddressed_arguments:
                print(f"   Unaddressed Arguments: {len(analysis.unaddressed_arguments)}")
            if analysis.unanswered_questions:
                for q in analysis.unanswered_questions[:3]:
                    print(f"     • {q[:50]}")

        # Narrative Summary
        if analysis.narrative_summary:
            print(f"\n📝 NARRATIVE SUMMARY")
            print("-" * 40)
            # Word wrap the summary
            words = analysis.narrative_summary.split()
            line = "   "
            for word in words:
                if len(line) + len(word) > 75:
                    print(line)
                    line = "   "
                line += word + " "
            if line.strip():
                print(line)

        print("\n" + "=" * 70)


# =============================================================================
# CLI Entry Point
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Deep Thread Analyzer')
    parser.add_argument('thread_url', help='Reddit thread URL to analyze')
    parser.add_argument('--api-key', help='Anthropic API key (or set ANTHROPIC_API_KEY)')
    parser.add_argument('--no-cache', action='store_true', help='Disable cache')
    parser.add_argument('--output', '-o', help='Output JSON file')

    args = parser.parse_args()

    try:
        analyzer = ThreadDeepAnalyzer(api_key=args.api_key)
        analysis = analyzer.analyze_thread(args.thread_url, use_cache=not args.no_cache)

        # Print to console
        analyzer.print_analysis(analysis)

        # Save to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(analyzer._analysis_to_dict(analysis), f, indent=2)
            print(f"\nSaved to: {args.output}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

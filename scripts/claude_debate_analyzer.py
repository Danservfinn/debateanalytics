#!/usr/bin/env python3
"""
Claude-Powered Debate Analysis Pipeline

Multi-stage debate analysis using Claude claude-sonnet-4-20250514 for:
1. Claim extraction and verification status
2. Argument mapping (support/attack relationships)
3. Fallacy detection
4. Rhetorical profiling per participant
5. Hidden gem finding (underrated quality comments)
6. Manipulation detection
7. Overall verdict synthesis

Usage:
    python claude_debate_analyzer.py --url "https://reddit.com/r/..." --output analysis.json
    python claude_debate_analyzer.py --input thread.json --output analysis.json
"""

import json
import sys
import os
import re
import argparse
import urllib.request
import ssl
import time
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class Claim:
    id: str
    text: str
    author: str
    comment_id: str
    source_cited: bool
    source_url: Optional[str]
    verification_status: str  # verified, disputed, unverified, sourced
    relevance_score: float

@dataclass
class ArgumentNode:
    id: str
    comment_id: str
    author: str
    position: str  # pro, con, neutral
    summary: str
    supports: List[str]  # IDs of arguments this supports
    attacks: List[str]   # IDs of arguments this attacks
    strength: float
    evidence_quality: float

@dataclass
class Fallacy:
    id: str
    type: str
    comment_id: str
    author: str
    severity: str  # high, medium, low
    description: str
    quote: str

@dataclass
class RhetoricalProfile:
    username: str
    style: str  # analytical, emotional, authoritative, collaborative, adversarial
    logic_score: float
    emotion_score: float
    evidence_score: float
    authority_score: float
    concession_score: float
    intellectual_honesty: float
    comment_count: int
    steelmans: int
    strawmans: int
    concessions: int
    dodges: int

@dataclass
class HiddenGem:
    comment_id: str
    author: str
    text: str
    karma: int
    quality_score: float
    reason_underrated: str

@dataclass
class ManipulationAlert:
    type: str  # coordinated, statistical_anomaly, talking_points, gish_gallop, bot_behavior, brigading, astroturfing
    severity: str  # high, medium, low
    description: str
    involved_users: List[str]

@dataclass
class DebateVerdict:
    overall_score: float
    core_dispute: str
    evidence_quality: float
    pro_arguments: int
    con_arguments: int
    consensus_points: List[str]
    unresolved_questions: List[str]
    red_flags: List[str]
    recommended_reading_time: int
    optimized_reading_path: List[str]

@dataclass
class FullAnalysis:
    claims: List[Claim]
    arguments: List[ArgumentNode]
    fallacies: List[Fallacy]
    rhetorical_profiles: List[RhetoricalProfile]
    hidden_gems: List[HiddenGem]
    manipulation_alerts: List[ManipulationAlert]
    verdict: DebateVerdict
    metadata: Dict[str, Any]
    analyzed_at: str


# ============================================================================
# Prompts
# ============================================================================

SYSTEM_PROMPT = """You are an expert debate analyst and critical thinking specialist.
You analyze online discussions with precision, identifying logical structures, fallacies,
manipulation patterns, and argument quality. You provide objective, balanced assessments
that help readers understand the true substance of debates beyond surface-level reactions.

Always respond with valid JSON matching the requested schema. Be thorough but concise."""

CLAIM_EXTRACTION_PROMPT = """Analyze this Reddit thread and extract all significant factual claims made.

Thread Title: {title}
Subreddit: r/{subreddit}

Comments:
{comments_text}

For each claim, determine:
1. The exact claim text
2. Who made it (author username)
3. Whether a source was cited
4. Verification status (verified, disputed, unverified, sourced)
5. Relevance to the core debate (0-1 score)

Respond with JSON:
{{
    "claims": [
        {{
            "id": "claim_1",
            "text": "the actual claim",
            "author": "username",
            "comment_id": "abc123",
            "source_cited": true/false,
            "source_url": "url or null",
            "verification_status": "verified|disputed|unverified|sourced",
            "relevance_score": 0.8
        }}
    ]
}}

Extract 10-20 of the most significant claims. Focus on factual assertions, not opinions."""

ARGUMENT_MAPPING_PROMPT = """Analyze the argument structure of this debate.

Thread Title: {title}
Claims identified: {claims_summary}

Comments (with IDs):
{comments_text}

Map each substantive comment as an argument node:
1. Position: pro (supports OP), con (opposes OP), or neutral
2. Summary: 1-2 sentence summary
3. What other arguments it supports or attacks (by ID)
4. Strength (0-1): how well-reasoned is it?
5. Evidence quality (0-1): how well-supported?

Respond with JSON:
{{
    "arguments": [
        {{
            "id": "arg_1",
            "comment_id": "abc123",
            "author": "username",
            "position": "pro|con|neutral",
            "summary": "brief summary",
            "supports": ["arg_2"],
            "attacks": ["arg_3"],
            "strength": 0.7,
            "evidence_quality": 0.6
        }}
    ]
}}

Focus on the 15-25 most substantive arguments."""

FALLACY_DETECTION_PROMPT = """Identify logical fallacies in this debate thread.

Thread Title: {title}
Comments:
{comments_text}

Look for these fallacy types:
- ad_hominem: Attacking the person instead of the argument
- strawman: Misrepresenting someone's argument
- false_dilemma: Presenting only two options when more exist
- appeal_to_authority: Using authority as evidence without justification
- slippery_slope: Claiming one thing leads to extreme consequences
- red_herring: Introducing irrelevant topics
- circular_reasoning: Using the conclusion as a premise
- hasty_generalization: Drawing broad conclusions from limited examples
- false_equivalence: Treating different things as if they're the same
- moving_goalposts: Changing criteria when the original is met
- gish_gallop: Overwhelming with many weak arguments
- tu_quoque: "You do it too" defense
- appeal_to_emotion: Using emotion instead of logic
- bandwagon: "Everyone believes this"
- no_true_scotsman: Dismissing counterexamples

Respond with JSON:
{{
    "fallacies": [
        {{
            "id": "fallacy_1",
            "type": "strawman",
            "comment_id": "abc123",
            "author": "username",
            "severity": "high|medium|low",
            "description": "Explanation of the fallacy",
            "quote": "Relevant quote from comment"
        }}
    ]
}}

Only flag clear fallacies, not mere rhetorical choices. Include 5-15 instances."""

RHETORICAL_PROFILING_PROMPT = """Profile each active participant's debate style.

Thread Title: {title}
Fallacies by user: {fallacies_summary}

Comments by user:
{comments_by_user}

For each participant who made 2+ comments, assess:
1. Primary style: analytical, emotional, authoritative, collaborative, adversarial
2. Scores (0-100 scale):
   - Logic: Use of reasoning and structured arguments
   - Emotion: Appeals to feelings
   - Evidence: Citation of facts/sources
   - Authority: Appeals to credentials/expertise
   - Concession: Willingness to acknowledge valid opposing points
3. Intellectual honesty (0-10): Overall good-faith engagement
4. Behavior counts:
   - Steelmans: Times they engaged with strongest version of opponent's argument
   - Strawmans: Times they misrepresented opponents
   - Concessions: Times they acknowledged valid points
   - Dodges: Times they avoided direct questions

Respond with JSON:
{{
    "profiles": [
        {{
            "username": "user1",
            "style": "analytical",
            "logic_score": 75,
            "emotion_score": 30,
            "evidence_score": 80,
            "authority_score": 20,
            "concession_score": 60,
            "intellectual_honesty": 7.5,
            "comment_count": 5,
            "steelmans": 2,
            "strawmans": 0,
            "concessions": 3,
            "dodges": 1
        }}
    ]
}}"""

HIDDEN_GEMS_PROMPT = """Find underrated comments in this thread - high quality but low karma.

Thread Title: {title}
Argument quality scores: {argument_scores}

Comments with karma:
{comments_with_karma}

Identify comments that:
1. Have below-median karma but above-median quality
2. Make substantive points that got overlooked
3. Posted late, deeply nested, or against the crowd

Respond with JSON:
{{
    "hidden_gems": [
        {{
            "comment_id": "abc123",
            "author": "username",
            "text": "Comment excerpt (first 200 chars)",
            "karma": 5,
            "quality_score": 8.5,
            "reason_underrated": "Posted 4 hours late when thread died down"
        }}
    ]
}}

Find 3-7 hidden gems if they exist."""

MANIPULATION_DETECTION_PROMPT = """Detect potential manipulation or inauthentic behavior.

Thread Title: {title}
Subreddit: r/{subreddit}

Timing and patterns:
{timing_data}

Comments:
{comments_text}

Look for:
1. Coordinated behavior: Multiple accounts posting similar content at similar times
2. Statistical anomalies: Unusual voting patterns, timing clusters
3. Talking points: Identical phrases across different users
4. Gish gallop: Single user overwhelming with many low-quality arguments
5. Bot behavior: Formulaic responses, instant replies, no engagement with replies
6. Brigading: Sudden influx of users from another community
7. Astroturfing: Fake grassroots support patterns

Respond with JSON:
{{
    "alerts": [
        {{
            "type": "coordinated|statistical_anomaly|talking_points|gish_gallop|bot_behavior|brigading|astroturfing",
            "severity": "high|medium|low",
            "description": "Specific evidence for this alert",
            "involved_users": ["user1", "user2"]
        }}
    ]
}}

Only flag patterns with actual evidence. Return empty array if thread appears organic."""

VERDICT_SYNTHESIS_PROMPT = """Synthesize a final verdict for this debate.

Thread Title: {title}
Original Post: {op_text}

Analysis Summary:
- Claims: {claims_count} extracted, {verified_count} verified, {disputed_count} disputed
- Arguments: {pro_count} pro, {con_count} con
- Fallacies: {fallacy_count} detected
- Avg intellectual honesty: {avg_honesty}
- Manipulation alerts: {alert_count}

Top arguments:
{top_arguments}

Respond with JSON:
{{
    "verdict": {{
        "overall_score": 72,
        "core_dispute": "One sentence describing the fundamental disagreement",
        "evidence_quality": 0.65,
        "pro_arguments": 12,
        "con_arguments": 18,
        "consensus_points": [
            "Point both sides agree on",
            "Another shared view"
        ],
        "unresolved_questions": [
            "Key question that wasn't adequately addressed",
            "Another open question"
        ],
        "red_flags": [
            "Concerning pattern or behavior",
            "Another issue to note"
        ],
        "recommended_reading_time": 15,
        "optimized_reading_path": ["comment_id_1", "comment_id_2", "comment_id_3"]
    }}
}}

The optimized_reading_path should list 5-10 comment IDs that give the best overview of the debate."""


# ============================================================================
# Claude Client
# ============================================================================

class ClaudeClient:
    """Wrapper for Anthropic Claude API calls"""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key
        self.model = model
        self.client = None

        # Try to use the official SDK
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=api_key)
            self.use_sdk = True
            print(f"Using Anthropic SDK with model: {model}", file=sys.stderr)
        except ImportError:
            self.use_sdk = False
            print("Anthropic SDK not found, using direct HTTP API", file=sys.stderr)

    def chat(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4096) -> str:
        """Make a chat completion call to Claude"""
        if self.use_sdk:
            return self._sdk_call(messages, temperature, max_tokens)
        else:
            return self._http_call(messages, temperature, max_tokens)

    def _sdk_call(self, messages: List[Dict], temperature: float, max_tokens: int) -> str:
        """Use official Anthropic SDK"""
        # Extract system message
        system_content = None
        user_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                user_messages.append(msg)

        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_content if system_content else "",
            messages=user_messages,
            temperature=temperature
        )
        return response.content[0].text

    def _http_call(self, messages: List[Dict], temperature: float, max_tokens: int) -> str:
        """Direct HTTP API call (fallback)"""
        import json
        import certifi

        url = "https://api.anthropic.com/v1/messages"

        # Extract system message
        system_content = None
        user_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                user_messages.append(msg)

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": user_messages,
            "temperature": temperature
        }
        if system_content:
            payload["system"] = system_content

        ssl_context = ssl.create_default_context(cafile=certifi.where())
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')

        max_retries = 3
        base_delay = 2

        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, context=ssl_context, timeout=180) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    return result['content'][0]['text']
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    delay = base_delay * (2 ** attempt)
                    print(f"Rate limited, waiting {delay}s...", file=sys.stderr)
                    time.sleep(delay)
                    continue
                else:
                    print(f"HTTP Error: {e.code} - {e.read().decode()}", file=sys.stderr)
                    raise
            except Exception as e:
                print(f"API Error: {e}", file=sys.stderr)
                raise

        raise Exception("Max retries exceeded")


# ============================================================================
# Reddit Thread Fetcher
# ============================================================================

def fetch_reddit_thread(url: str) -> Dict:
    """Fetch Reddit thread data via JSON API"""
    import certifi

    print(f"Fetching thread: {url}", file=sys.stderr)

    # Convert URL to JSON API endpoint
    json_url = url.rstrip('/') + '.json'

    headers = {
        'User-Agent': 'DebateAnalyzer/1.0 (Research Project)'
    }

    ssl_context = ssl.create_default_context(cafile=certifi.where())
    req = urllib.request.Request(json_url, headers=headers)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, context=ssl_context, timeout=30) as response:
                data = json.loads(response.read().decode('utf-8'))
                break
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise Exception(f"Failed to fetch thread: {e}")

    # Parse Reddit's response format
    post_data = data[0]['data']['children'][0]['data']
    comments_data = data[1]['data']['children']

    def flatten_comments(comments, depth=0) -> List[Dict]:
        """Recursively flatten comment tree"""
        result = []
        for c in comments:
            if c['kind'] != 't1':  # Skip non-comments
                continue

            cdata = c['data']
            result.append({
                'id': cdata.get('id', ''),
                'author': cdata.get('author', '[deleted]'),
                'body': cdata.get('body', ''),
                'score': cdata.get('score', 0),
                'created_utc': cdata.get('created_utc', 0),
                'depth': depth,
                'parent_id': cdata.get('parent_id', ''),
                'controversiality': cdata.get('controversiality', 0)
            })

            # Process replies
            replies = cdata.get('replies', '')
            if isinstance(replies, dict):
                children = replies.get('data', {}).get('children', [])
                result.extend(flatten_comments(children, depth + 1))

        return result

    comments = flatten_comments(comments_data)

    return {
        'metadata': {
            'id': post_data.get('id', ''),
            'title': post_data.get('title', ''),
            'author': post_data.get('author', '[deleted]'),
            'subreddit': post_data.get('subreddit', ''),
            'selftext': post_data.get('selftext', ''),
            'score': post_data.get('score', 0),
            'upvote_ratio': post_data.get('upvote_ratio', 0),
            'num_comments': post_data.get('num_comments', 0),
            'created_utc': post_data.get('created_utc', 0),
            'url': url
        },
        'comments': comments
    }


# ============================================================================
# Debate Analyzer
# ============================================================================

class DebateAnalyzer:
    """Multi-stage debate analysis pipeline using Claude"""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = ClaudeClient(api_key, model)
        self.analysis_cache = {}

    def _format_comments(self, comments: List[Dict], include_meta: bool = False) -> str:
        """Format comments for prompt injection"""
        formatted = []
        for c in comments[:100]:  # Limit to 100 comments for token limits
            author = c.get('author', '[deleted]')
            body = c.get('body', '')[:1000]
            score = c.get('score', 0)
            depth = c.get('depth', 0)
            cid = c.get('id', 'unknown')

            indent = "  " * min(depth, 4)
            if include_meta:
                formatted.append(f"{indent}[{cid}] u/{author} (karma: {score}, depth: {depth}):\n{indent}{body}\n")
            else:
                formatted.append(f"{indent}u/{author}: {body}\n")

        return "\n".join(formatted)

    def _parse_json_response(self, response: str) -> Dict:
        """Extract JSON from response"""
        # Try to find JSON in code blocks
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        if json_match:
            response = json_match.group(1)

        # Clean common issues
        response = response.strip()
        if not response.startswith('{') and not response.startswith('['):
            # Find first { or [
            start = min(
                response.find('{') if response.find('{') != -1 else len(response),
                response.find('[') if response.find('[') != -1 else len(response)
            )
            if start < len(response):
                response = response[start:]

        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}", file=sys.stderr)
            print(f"Response: {response[:500]}...", file=sys.stderr)
            return {}

    def _call_llm(self, prompt: str, temperature: float = 0.3) -> Dict:
        """Make LLM call and parse JSON response"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        response = self.client.chat(messages, temperature=temperature)
        time.sleep(0.5)  # Small delay between calls
        return self._parse_json_response(response)

    def extract_claims(self, thread_data: Dict) -> List[Claim]:
        """Stage 1: Extract factual claims"""
        print("  Stage 1: Extracting claims...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        prompt = CLAIM_EXTRACTION_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            subreddit=metadata.get('subreddit', 'unknown'),
            comments_text=self._format_comments(comments)
        )

        result = self._call_llm(prompt)
        claims = []

        for c in result.get('claims', []):
            claims.append(Claim(
                id=c.get('id', f"claim_{len(claims)}"),
                text=c.get('text', ''),
                author=c.get('author', ''),
                comment_id=c.get('comment_id', ''),
                source_cited=c.get('source_cited', False),
                source_url=c.get('source_url'),
                verification_status=c.get('verification_status', 'unverified'),
                relevance_score=c.get('relevance_score', 0.5)
            ))

        return claims

    def map_arguments(self, thread_data: Dict, claims: List[Claim]) -> List[ArgumentNode]:
        """Stage 2: Map argument structure"""
        print("  Stage 2: Mapping arguments...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        claims_summary = "\n".join([f"- {c.id}: {c.text[:100]}..." for c in claims[:10]])

        prompt = ARGUMENT_MAPPING_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            claims_summary=claims_summary,
            comments_text=self._format_comments(comments, include_meta=True)
        )

        result = self._call_llm(prompt)
        arguments = []

        for a in result.get('arguments', []):
            arguments.append(ArgumentNode(
                id=a.get('id', f"arg_{len(arguments)}"),
                comment_id=a.get('comment_id', ''),
                author=a.get('author', ''),
                position=a.get('position', 'neutral'),
                summary=a.get('summary', ''),
                supports=a.get('supports', []),
                attacks=a.get('attacks', []),
                strength=a.get('strength', 0.5),
                evidence_quality=a.get('evidence_quality', 0.5)
            ))

        return arguments

    def detect_fallacies(self, thread_data: Dict) -> List[Fallacy]:
        """Stage 3: Detect logical fallacies"""
        print("  Stage 3: Detecting fallacies...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        prompt = FALLACY_DETECTION_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            comments_text=self._format_comments(comments, include_meta=True)
        )

        result = self._call_llm(prompt)
        fallacies = []

        for f in result.get('fallacies', []):
            fallacies.append(Fallacy(
                id=f.get('id', f"fallacy_{len(fallacies)}"),
                type=f.get('type', 'unknown'),
                comment_id=f.get('comment_id', ''),
                author=f.get('author', ''),
                severity=f.get('severity', 'medium'),
                description=f.get('description', ''),
                quote=f.get('quote', '')
            ))

        return fallacies

    def profile_rhetoric(self, thread_data: Dict, fallacies: List[Fallacy]) -> List[RhetoricalProfile]:
        """Stage 4: Profile participant rhetoric"""
        print("  Stage 4: Profiling rhetoric...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        # Group comments by user
        by_user = {}
        for c in comments:
            author = c.get('author', '[deleted]')
            if author not in by_user:
                by_user[author] = []
            by_user[author].append(c)

        # Filter to users with 2+ comments
        active_users = {k: v for k, v in by_user.items() if len(v) >= 2 and k != '[deleted]'}

        comments_by_user = ""
        for user, user_comments in list(active_users.items())[:20]:
            comments_by_user += f"\n=== u/{user} ({len(user_comments)} comments) ===\n"
            for c in user_comments[:5]:
                comments_by_user += f"  [{c.get('id')}]: {c.get('body', '')[:300]}...\n"

        fallacies_summary = {}
        for f in fallacies:
            if f.author not in fallacies_summary:
                fallacies_summary[f.author] = []
            fallacies_summary[f.author].append(f.type)
        fallacies_str = "\n".join([f"u/{k}: {', '.join(v)}" for k, v in fallacies_summary.items()])

        prompt = RHETORICAL_PROFILING_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            fallacies_summary=fallacies_str or "None detected",
            comments_by_user=comments_by_user
        )

        result = self._call_llm(prompt)
        profiles = []

        for p in result.get('profiles', []):
            profiles.append(RhetoricalProfile(
                username=p.get('username', ''),
                style=p.get('style', 'analytical'),
                logic_score=p.get('logic_score', 50),
                emotion_score=p.get('emotion_score', 50),
                evidence_score=p.get('evidence_score', 50),
                authority_score=p.get('authority_score', 50),
                concession_score=p.get('concession_score', 50),
                intellectual_honesty=p.get('intellectual_honesty', 5),
                comment_count=p.get('comment_count', 0),
                steelmans=p.get('steelmans', 0),
                strawmans=p.get('strawmans', 0),
                concessions=p.get('concessions', 0),
                dodges=p.get('dodges', 0)
            ))

        return profiles

    def find_hidden_gems(self, thread_data: Dict, arguments: List[ArgumentNode]) -> List[HiddenGem]:
        """Stage 5: Find underrated quality comments"""
        print("  Stage 5: Finding hidden gems...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        # Calculate median karma
        karmas = [c.get('score', 0) for c in comments if c.get('score', 0) > 0]
        median_karma = sorted(karmas)[len(karmas)//2] if karmas else 5

        # Format comments with karma
        comments_with_karma = ""
        for c in comments[:80]:
            cid = c.get('id', '')
            author = c.get('author', '[deleted]')
            karma = c.get('score', 0)
            body = c.get('body', '')[:400]
            created = c.get('created_utc', 0)
            comments_with_karma += f"[{cid}] u/{author} (karma: {karma}, time: {created}):\n{body}\n\n"

        # Build argument scores reference
        arg_scores = {a.comment_id: a.strength for a in arguments}
        arg_scores_str = json.dumps(arg_scores, indent=2)

        prompt = HIDDEN_GEMS_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            argument_scores=arg_scores_str,
            comments_with_karma=comments_with_karma
        )

        result = self._call_llm(prompt)
        gems = []

        for g in result.get('hidden_gems', []):
            gems.append(HiddenGem(
                comment_id=g.get('comment_id', ''),
                author=g.get('author', ''),
                text=g.get('text', '')[:200],
                karma=g.get('karma', 0),
                quality_score=g.get('quality_score', 5),
                reason_underrated=g.get('reason_underrated', '')
            ))

        return gems

    def detect_manipulation(self, thread_data: Dict) -> List[ManipulationAlert]:
        """Stage 6: Detect manipulation patterns"""
        print("  Stage 6: Detecting manipulation...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        # Build timing data
        timing_data = "Comment timing distribution:\n"
        time_buckets = {}
        for c in comments:
            created = c.get('created_utc', 0)
            bucket = created // 3600  # Hour buckets
            if bucket not in time_buckets:
                time_buckets[bucket] = 0
            time_buckets[bucket] += 1

        for bucket, count in sorted(time_buckets.items())[:10]:
            timing_data += f"  Hour {bucket}: {count} comments\n"

        prompt = MANIPULATION_DETECTION_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            subreddit=metadata.get('subreddit', 'unknown'),
            timing_data=timing_data,
            comments_text=self._format_comments(comments, include_meta=True)
        )

        result = self._call_llm(prompt)
        alerts = []

        for a in result.get('alerts', []):
            alerts.append(ManipulationAlert(
                type=a.get('type', 'unknown'),
                severity=a.get('severity', 'low'),
                description=a.get('description', ''),
                involved_users=a.get('involved_users', [])
            ))

        return alerts

    def synthesize_verdict(self, thread_data: Dict, claims: List[Claim],
                          arguments: List[ArgumentNode], fallacies: List[Fallacy],
                          profiles: List[RhetoricalProfile], alerts: List[ManipulationAlert]) -> DebateVerdict:
        """Stage 7: Synthesize overall verdict"""
        print("  Stage 7: Synthesizing verdict...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})

        # Calculate stats
        verified = sum(1 for c in claims if c.verification_status == 'verified')
        disputed = sum(1 for c in claims if c.verification_status == 'disputed')
        pro_count = sum(1 for a in arguments if a.position == 'pro')
        con_count = sum(1 for a in arguments if a.position == 'con')
        avg_honesty = sum(p.intellectual_honesty for p in profiles) / len(profiles) if profiles else 5

        # Top arguments
        top_args = sorted(arguments, key=lambda x: x.strength, reverse=True)[:5]
        top_args_str = "\n".join([
            f"- [{a.position.upper()}] {a.summary} (strength: {a.strength})"
            for a in top_args
        ])

        prompt = VERDICT_SYNTHESIS_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            op_text=metadata.get('selftext', '')[:500],
            claims_count=len(claims),
            verified_count=verified,
            disputed_count=disputed,
            pro_count=pro_count,
            con_count=con_count,
            fallacy_count=len(fallacies),
            avg_honesty=f"{avg_honesty:.1f}",
            alert_count=len(alerts),
            top_arguments=top_args_str
        )

        result = self._call_llm(prompt)
        v = result.get('verdict', {})

        return DebateVerdict(
            overall_score=v.get('overall_score', 50),
            core_dispute=v.get('core_dispute', 'Unable to determine core dispute'),
            evidence_quality=v.get('evidence_quality', 0.5),
            pro_arguments=v.get('pro_arguments', pro_count),
            con_arguments=v.get('con_arguments', con_count),
            consensus_points=v.get('consensus_points', []),
            unresolved_questions=v.get('unresolved_questions', []),
            red_flags=v.get('red_flags', []),
            recommended_reading_time=v.get('recommended_reading_time', 10),
            optimized_reading_path=v.get('optimized_reading_path', [])
        )

    def analyze(self, thread_data: Dict) -> FullAnalysis:
        """Run full analysis pipeline"""
        print("Starting deep analysis pipeline...", file=sys.stderr)

        # Run all stages
        claims = self.extract_claims(thread_data)
        arguments = self.map_arguments(thread_data, claims)
        fallacies = self.detect_fallacies(thread_data)
        profiles = self.profile_rhetoric(thread_data, fallacies)
        hidden_gems = self.find_hidden_gems(thread_data, arguments)
        alerts = self.detect_manipulation(thread_data)
        verdict = self.synthesize_verdict(thread_data, claims, arguments, fallacies, profiles, alerts)

        from datetime import datetime, timezone

        return FullAnalysis(
            claims=claims,
            arguments=arguments,
            fallacies=fallacies,
            rhetorical_profiles=profiles,
            hidden_gems=hidden_gems,
            manipulation_alerts=alerts,
            verdict=verdict,
            metadata=thread_data.get('metadata', {}),
            analyzed_at=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        )


# ============================================================================
# Serialization
# ============================================================================

def dataclass_to_dict(obj):
    """Convert dataclass to dict, handling nested structures"""
    if hasattr(obj, '__dataclass_fields__'):
        return {k: dataclass_to_dict(v) for k, v in asdict(obj).items()}
    elif isinstance(obj, list):
        return [dataclass_to_dict(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: dataclass_to_dict(v) for k, v in obj.items()}
    else:
        return obj


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Analyze Reddit debate threads with Claude')
    parser.add_argument('--url', type=str, help='Reddit thread URL to analyze')
    parser.add_argument('--input', type=str, help='Input JSON file with thread data')
    parser.add_argument('--output', type=str, help='Output JSON file for analysis results')
    parser.add_argument('--model', type=str, default='claude-sonnet-4-20250514', help='Claude model to use')
    parser.add_argument('--api-key', type=str, help='Anthropic API key (or set ANTHROPIC_API_KEY)')

    args = parser.parse_args()

    # Get API key
    api_key = args.api_key or os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print("Error: API key required. Set ANTHROPIC_API_KEY or use --api-key", file=sys.stderr)
        sys.exit(1)

    # Get thread data
    if args.url:
        thread_data = fetch_reddit_thread(args.url)
    elif args.input:
        with open(args.input) as f:
            thread_data = json.load(f)
    else:
        print("Error: Either --url or --input required", file=sys.stderr)
        sys.exit(1)

    # Run analysis
    analyzer = DebateAnalyzer(api_key, args.model)
    analysis = analyzer.analyze(thread_data)

    # Output results
    result = dataclass_to_dict(analysis)

    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Analysis saved to {args.output}", file=sys.stderr)
    else:
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

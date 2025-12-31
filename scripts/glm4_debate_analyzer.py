#!/usr/bin/env python3
"""
Debate Analysis Engine powered by ZhipuAI GLM-4
Multi-stage pipeline for deep Reddit thread analysis

Usage:
    python glm4_debate_analyzer.py --url "https://reddit.com/r/..." --output analysis.json
    python glm4_debate_analyzer.py --input thread.json --output analysis.json
"""

import os
import sys
import json
import asyncio
import argparse
import re
import ssl
import certifi
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum
import urllib.request
import http.client

# Try to import zhipuai, fall back to direct API calls if not available
try:
    from zhipuai import ZhipuAI
    HAS_ZHIPUAI = True
except ImportError:
    HAS_ZHIPUAI = False
    import httpx

# ============================================================================
# Data Classes for Structured Output
# ============================================================================

@dataclass
class Claim:
    id: str
    text: str
    author: str
    comment_id: str
    source_cited: bool
    source_url: Optional[str]
    verification_status: str  # "verified", "unverified", "disputed", "false"
    refuted_by: List[str] = field(default_factory=list)
    relevance_score: float = 0.5

@dataclass
class Fallacy:
    id: str
    type: str
    description: str
    comment_id: str
    author: str
    quote: str
    severity: str  # "minor", "moderate", "major"

@dataclass
class ArgumentNode:
    id: str
    comment_id: str
    author: str
    position: str  # "support", "oppose", "nuanced", "neutral"
    summary: str
    quality_score: float
    depth: int
    parent_id: Optional[str] = None
    children: List[str] = field(default_factory=list)
    claims: List[str] = field(default_factory=list)

@dataclass
class RhetoricalProfile:
    username: str
    comment_count: int
    logic_score: float       # 0-100
    emotion_score: float     # 0-100
    evidence_score: float    # 0-100
    authority_score: float   # 0-100
    concession_score: float  # 0-100
    style: str               # "analytical", "emotional", "balanced", "aggressive", "passive"
    intellectual_honesty: float  # 0-10
    steelmans: int = 0
    strawmans: int = 0
    concessions: int = 0
    dodges: int = 0

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
    type: str  # "coordinated", "statistical_anomaly", "talking_points", "gish_gallop"
    description: str
    evidence: List[str]
    severity: str  # "low", "medium", "high"
    involved_users: List[str] = field(default_factory=list)

@dataclass
class DebateVerdict:
    overall_score: float           # 1-10
    core_dispute: str
    evidence_quality_pct: float
    pro_arguments: int
    con_arguments: int
    pro_strong: int
    con_strong: int
    consensus_points: List[str] = field(default_factory=list)
    contested_points: List[str] = field(default_factory=list)
    unresolved_questions: List[str] = field(default_factory=list)
    red_flags: List[str] = field(default_factory=list)
    recommendation: str = ""
    worth_reading: bool = True
    must_read_comments: List[str] = field(default_factory=list)
    skip_branches: List[str] = field(default_factory=list)
    reading_time_minutes: int = 5
    optimized_path_minutes: int = 2

@dataclass
class FullAnalysis:
    thread_id: str
    thread_title: str
    subreddit: str
    analyzed_at: str
    verdict: DebateVerdict
    claims: List[Claim] = field(default_factory=list)
    arguments: List[ArgumentNode] = field(default_factory=list)
    fallacies: List[Fallacy] = field(default_factory=list)
    rhetorical_profiles: List[RhetoricalProfile] = field(default_factory=list)
    hidden_gems: List[HiddenGem] = field(default_factory=list)
    manipulation_alerts: List[ManipulationAlert] = field(default_factory=list)


# ============================================================================
# GLM-4 Prompts for Each Analysis Stage
# ============================================================================

SYSTEM_PROMPT = """You are an expert debate analyst with deep knowledge of logic, rhetoric, and argumentation theory.
You analyze online debates to help truth-seekers distinguish signal from noise.
Always respond with valid JSON matching the requested schema exactly.
Be objective, thorough, and intellectually honest in your analysis."""

CLAIM_EXTRACTION_PROMPT = """Analyze this Reddit thread and extract all discrete factual claims made by participants.

A claim is a statement that asserts something is true and could potentially be verified or falsified.
Exclude opinions, questions, and purely subjective statements.

For each claim, assess:
1. Whether a source/evidence was cited
2. The source URL if provided
3. Initial verification status (verified/unverified/disputed)
4. Relevance to the core debate (0-1 score)

Thread title: {title}
Subreddit: r/{subreddit}

Comments:
{comments_text}

Respond with JSON:
{{
  "claims": [
    {{
      "id": "claim_1",
      "text": "The exact claim text",
      "author": "username",
      "comment_id": "abc123",
      "source_cited": true,
      "source_url": "https://...",
      "verification_status": "unverified",
      "relevance_score": 0.85
    }}
  ]
}}"""

ARGUMENT_MAPPING_PROMPT = """Map the argument structure of this Reddit debate.

Identify each distinct argument and its relationship to others:
- What position does it take? (support/oppose/nuanced/neutral)
- What is its quality? (score 1-10 based on logic, evidence, and clarity)
- What parent argument is it responding to?
- What claims does it contain?

Thread title: {title}
Original post position: {op_position}

Comments:
{comments_text}

Previously extracted claims:
{claims_json}

Respond with JSON:
{{
  "arguments": [
    {{
      "id": "arg_1",
      "comment_id": "abc123",
      "author": "username",
      "position": "oppose",
      "summary": "One sentence summary of the argument",
      "quality_score": 7.5,
      "depth": 0,
      "parent_id": null,
      "children": ["arg_2", "arg_3"],
      "claims": ["claim_1", "claim_2"]
    }}
  ],
  "argument_flow_summary": "Brief description of how the debate evolved"
}}"""

FALLACY_DETECTION_PROMPT = """Analyze this Reddit debate for logical fallacies.

Look for these common fallacies:
- Ad hominem: Attacking the person instead of the argument
- Straw man: Misrepresenting someone's argument
- False dichotomy: Presenting only two options when more exist
- Appeal to authority: Using authority as evidence without substance
- Appeal to emotion: Using emotions instead of logic
- Slippery slope: Claiming one thing will lead to extreme outcomes
- Red herring: Introducing irrelevant information
- Tu quoque/Whataboutism: Deflecting by pointing to others' behavior
- Hasty generalization: Drawing broad conclusions from limited evidence
- Moving goalposts: Changing criteria after an argument is met
- Circular reasoning: Using the conclusion as a premise
- False equivalence: Treating unequal things as equal

Thread title: {title}

Comments:
{comments_text}

For each fallacy found, quote the exact text and explain why it's fallacious.

Respond with JSON:
{{
  "fallacies": [
    {{
      "id": "fallacy_1",
      "type": "straw_man",
      "description": "Misrepresents opponent's position by claiming they want X when they actually argued Y",
      "comment_id": "abc123",
      "author": "username",
      "quote": "So you're saying we should just let chaos reign?",
      "severity": "moderate"
    }}
  ],
  "fallacy_density": "low/medium/high",
  "most_common_fallacy": "type_name"
}}"""

RHETORIC_PROFILING_PROMPT = """Profile each participant's rhetorical style in this debate.

Analyze users with 2+ comments for:
1. Logic vs Emotion ratio (how much they rely on logical arguments vs emotional appeals)
2. Evidence usage (do they cite sources, provide data?)
3. Authority appeals (do they cite experts, credentials?)
4. Concession willingness (do they acknowledge valid opposing points?)
5. Steelmanning (do they address the strongest version of opposing arguments?)
6. Strawmanning (do they misrepresent opposing arguments?)
7. Overall intellectual honesty (0-10)

Thread title: {title}

Comments:
{comments_text}

Fallacies by user:
{fallacies_by_user}

Respond with JSON:
{{
  "profiles": [
    {{
      "username": "user1",
      "comment_count": 5,
      "logic_score": 75,
      "emotion_score": 25,
      "evidence_score": 60,
      "authority_score": 30,
      "concession_score": 40,
      "style": "analytical",
      "intellectual_honesty": 7.5,
      "steelmans": 2,
      "strawmans": 1,
      "concessions": 1,
      "dodges": 0
    }}
  ]
}}"""

HIDDEN_GEMS_PROMPT = """Find hidden gems in this Reddit debate - high-quality comments that received low engagement.

A hidden gem is a comment that:
- Makes a substantive, well-reasoned argument
- Provides unique insight or perspective
- Cites evidence or sources
- BUT has low karma relative to its quality

Thread title: {title}
Average karma in thread: {avg_karma}

Comments with low karma (below average):
{low_karma_comments}

Argument quality scores:
{quality_scores}

Respond with JSON:
{{
  "hidden_gems": [
    {{
      "comment_id": "abc123",
      "author": "username",
      "text": "The full comment text (truncated if very long)",
      "karma": 3,
      "quality_score": 8.5,
      "reason_underrated": "Posted late in thread, buried under top-level comments"
    }}
  ]
}}"""

MANIPULATION_DETECTION_PROMPT = """Analyze this thread for signs of manipulation or bad-faith participation.

Look for:
1. Coordinated behavior: Multiple accounts posting similar content
2. Statistical anomalies: Unusual voting patterns
3. Talking point repetition: Same phrases from multiple accounts
4. Gish gallop: Overwhelming with many weak arguments
5. Astroturfing signs: New accounts, similar creation dates
6. Bad faith patterns: Never conceding, constant deflection

Thread title: {title}

Comments with metadata:
{comments_with_meta}

Respond with JSON:
{{
  "alerts": [
    {{
      "type": "talking_points",
      "description": "The phrase 'think of the children' appears 5 times from 3 different accounts",
      "evidence": ["comment_id_1", "comment_id_2"],
      "severity": "medium",
      "involved_users": ["user1", "user2", "user3"]
    }}
  ],
  "overall_manipulation_risk": "low/medium/high"
}}"""

VERDICT_SYNTHESIS_PROMPT = """Synthesize a final verdict on this Reddit debate.

Based on all the analysis, provide a comprehensive summary that helps truth-seekers understand:
1. What is the core dispute?
2. What is the quality of evidence on each side?
3. Where is there consensus vs. genuine disagreement?
4. What questions remain unresolved?
5. Is this debate worth reading? Which comments are essential?

Thread title: {title}
Subreddit: r/{subreddit}

Analysis summary:
- Total claims: {total_claims}
- Verified claims: {verified_claims}
- Total fallacies: {total_fallacies}
- Participants analyzed: {participants}
- Average intellectual honesty: {avg_honesty}

Top arguments by quality:
{top_arguments}

Key fallacies:
{key_fallacies}

Consensus points identified:
{consensus}

Respond with JSON:
{{
  "overall_score": 7.5,
  "core_dispute": "One sentence describing the central disagreement",
  "evidence_quality_pct": 65,
  "pro_arguments": 12,
  "con_arguments": 8,
  "pro_strong": 4,
  "con_strong": 3,
  "consensus_points": ["Point both sides agree on"],
  "contested_points": ["Points of genuine disagreement"],
  "unresolved_questions": ["Questions that weren't answered"],
  "red_flags": ["Any concerns about the debate quality"],
  "recommendation": "Worth reading with focus on X and Y",
  "worth_reading": true,
  "must_read_comments": ["comment_id_1", "comment_id_2"],
  "skip_branches": ["comment_id of thread to skip"],
  "reading_time_minutes": 12,
  "optimized_path_minutes": 4
}}"""


# ============================================================================
# GLM-4 Client
# ============================================================================

class GLM4Client:
    """Client for ZhipuAI GLM-4 API"""

    def __init__(self, api_key: str, model: str = "glm-4-plus"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://open.bigmodel.cn/api/paas/v4"

        if HAS_ZHIPUAI:
            self.client = ZhipuAI(api_key=api_key)
        else:
            self.client = None

    def chat(self, messages: List[Dict], temperature: float = 0.3, max_tokens: int = 4096) -> str:
        """Send chat completion request to GLM-4"""

        if HAS_ZHIPUAI and self.client:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        else:
            # Direct API call fallback
            return self._direct_api_call(messages, temperature, max_tokens)

    def _direct_api_call(self, messages: List[Dict], temperature: float, max_tokens: int) -> str:
        """Direct HTTP API call to ZhipuAI"""
        import json

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        # Create SSL context
        ssl_context = ssl.create_default_context(cafile=certifi.where())

        # Make request
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')

        try:
            with urllib.request.urlopen(req, context=ssl_context, timeout=120) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result['choices'][0]['message']['content']
        except Exception as e:
            print(f"API Error: {e}", file=sys.stderr)
            raise


# ============================================================================
# Debate Analyzer
# ============================================================================

class DebateAnalyzer:
    """Multi-stage debate analysis pipeline using GLM-4"""

    def __init__(self, api_key: str, model: str = "glm-4-plus"):
        self.client = GLM4Client(api_key, model)
        self.analysis_cache = {}

    def _format_comments(self, comments: List[Dict], include_meta: bool = False) -> str:
        """Format comments for prompt injection"""
        formatted = []
        for c in comments:
            author = c.get('author', '[deleted]')
            body = c.get('body', '')[:1000]  # Truncate long comments
            score = c.get('score', 0)
            depth = c.get('depth', 0)
            cid = c.get('id', 'unknown')

            indent = "  " * depth
            if include_meta:
                formatted.append(f"{indent}[{cid}] u/{author} (karma: {score}, depth: {depth}):\n{indent}{body}\n")
            else:
                formatted.append(f"{indent}u/{author}: {body}\n")

        return "\n".join(formatted)

    def _parse_json_response(self, response: str) -> Dict:
        """Extract JSON from response, handling markdown code blocks"""
        # Try to find JSON in code blocks
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        if json_match:
            response = json_match.group(1)

        # Clean up common issues
        response = response.strip()
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]

        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}", file=sys.stderr)
            print(f"Response was: {response[:500]}...", file=sys.stderr)
            return {}

    def _call_llm(self, prompt: str, temperature: float = 0.3) -> Dict:
        """Make LLM call and parse JSON response"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        response = self.client.chat(messages, temperature=temperature)
        return self._parse_json_response(response)

    def extract_claims(self, thread_data: Dict) -> List[Claim]:
        """Stage 1: Extract factual claims from thread"""
        print("  Extracting claims...", file=sys.stderr)

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
        print("  Mapping arguments...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        # Determine OP's position from the post
        selftext = metadata.get('selftext', '')
        op_position = "unclear"
        if selftext:
            op_position = "stated in original post"

        claims_json = json.dumps([asdict(c) for c in claims], indent=2)

        prompt = ARGUMENT_MAPPING_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            op_position=op_position,
            comments_text=self._format_comments(comments),
            claims_json=claims_json
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
                quality_score=a.get('quality_score', 5.0),
                depth=a.get('depth', 0),
                parent_id=a.get('parent_id'),
                children=a.get('children', []),
                claims=a.get('claims', [])
            ))

        return arguments

    def detect_fallacies(self, thread_data: Dict) -> List[Fallacy]:
        """Stage 3: Detect logical fallacies"""
        print("  Detecting fallacies...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        prompt = FALLACY_DETECTION_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            comments_text=self._format_comments(comments)
        )

        result = self._call_llm(prompt)
        fallacies = []

        for f in result.get('fallacies', []):
            fallacies.append(Fallacy(
                id=f.get('id', f"fallacy_{len(fallacies)}"),
                type=f.get('type', 'unknown'),
                description=f.get('description', ''),
                comment_id=f.get('comment_id', ''),
                author=f.get('author', ''),
                quote=f.get('quote', ''),
                severity=f.get('severity', 'minor')
            ))

        return fallacies

    def profile_rhetoric(self, thread_data: Dict, fallacies: List[Fallacy]) -> List[RhetoricalProfile]:
        """Stage 4: Profile each participant's rhetorical style"""
        print("  Profiling rhetoric...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        # Group fallacies by user
        fallacies_by_user = {}
        for f in fallacies:
            user = f.author
            if user not in fallacies_by_user:
                fallacies_by_user[user] = []
            fallacies_by_user[user].append(f.type)

        prompt = RHETORIC_PROFILING_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            comments_text=self._format_comments(comments),
            fallacies_by_user=json.dumps(fallacies_by_user, indent=2)
        )

        result = self._call_llm(prompt)
        profiles = []

        for p in result.get('profiles', []):
            profiles.append(RhetoricalProfile(
                username=p.get('username', ''),
                comment_count=p.get('comment_count', 0),
                logic_score=p.get('logic_score', 50),
                emotion_score=p.get('emotion_score', 50),
                evidence_score=p.get('evidence_score', 50),
                authority_score=p.get('authority_score', 50),
                concession_score=p.get('concession_score', 50),
                style=p.get('style', 'balanced'),
                intellectual_honesty=p.get('intellectual_honesty', 5.0),
                steelmans=p.get('steelmans', 0),
                strawmans=p.get('strawmans', 0),
                concessions=p.get('concessions', 0),
                dodges=p.get('dodges', 0)
            ))

        return profiles

    def find_hidden_gems(self, thread_data: Dict, arguments: List[ArgumentNode]) -> List[HiddenGem]:
        """Stage 5: Find underrated quality comments"""
        print("  Finding hidden gems...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        # Calculate average karma
        karma_scores = [c.get('score', 0) for c in comments]
        avg_karma = sum(karma_scores) / len(karma_scores) if karma_scores else 0

        # Filter to low-karma comments
        low_karma = [c for c in comments if c.get('score', 0) < avg_karma]

        # Get quality scores from arguments
        quality_scores = {a.comment_id: a.quality_score for a in arguments}

        prompt = HIDDEN_GEMS_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            avg_karma=avg_karma,
            low_karma_comments=self._format_comments(low_karma, include_meta=True),
            quality_scores=json.dumps(quality_scores, indent=2)
        )

        result = self._call_llm(prompt)
        gems = []

        for g in result.get('hidden_gems', []):
            gems.append(HiddenGem(
                comment_id=g.get('comment_id', ''),
                author=g.get('author', ''),
                text=g.get('text', '')[:500],  # Truncate
                karma=g.get('karma', 0),
                quality_score=g.get('quality_score', 0),
                reason_underrated=g.get('reason_underrated', '')
            ))

        return gems

    def detect_manipulation(self, thread_data: Dict) -> List[ManipulationAlert]:
        """Stage 6: Detect potential manipulation"""
        print("  Detecting manipulation...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        comments = thread_data.get('comments', [])

        prompt = MANIPULATION_DETECTION_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            comments_with_meta=self._format_comments(comments, include_meta=True)
        )

        result = self._call_llm(prompt)
        alerts = []

        for a in result.get('alerts', []):
            alerts.append(ManipulationAlert(
                type=a.get('type', 'unknown'),
                description=a.get('description', ''),
                evidence=a.get('evidence', []),
                severity=a.get('severity', 'low'),
                involved_users=a.get('involved_users', [])
            ))

        return alerts

    def synthesize_verdict(
        self,
        thread_data: Dict,
        claims: List[Claim],
        arguments: List[ArgumentNode],
        fallacies: List[Fallacy],
        profiles: List[RhetoricalProfile]
    ) -> DebateVerdict:
        """Stage 7: Synthesize final verdict"""
        print("  Synthesizing verdict...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})

        # Calculate summary stats
        verified_claims = len([c for c in claims if c.verification_status == 'verified'])
        avg_honesty = sum(p.intellectual_honesty for p in profiles) / len(profiles) if profiles else 5.0

        # Get top arguments
        sorted_args = sorted(arguments, key=lambda a: a.quality_score, reverse=True)[:5]
        top_args = [{"author": a.author, "summary": a.summary, "score": a.quality_score} for a in sorted_args]

        # Identify consensus (arguments where multiple users agree)
        positions = {}
        for a in arguments:
            if a.summary:
                key = a.summary[:50]
                if key not in positions:
                    positions[key] = []
                positions[key].append(a.author)
        consensus = [k for k, v in positions.items() if len(set(v)) > 1]

        prompt = VERDICT_SYNTHESIS_PROMPT.format(
            title=metadata.get('title', 'Unknown'),
            subreddit=metadata.get('subreddit', 'unknown'),
            total_claims=len(claims),
            verified_claims=verified_claims,
            total_fallacies=len(fallacies),
            participants=len(profiles),
            avg_honesty=f"{avg_honesty:.1f}",
            top_arguments=json.dumps(top_args, indent=2),
            key_fallacies=json.dumps([{"type": f.type, "severity": f.severity} for f in fallacies[:5]], indent=2),
            consensus=json.dumps(consensus[:5], indent=2)
        )

        result = self._call_llm(prompt)

        return DebateVerdict(
            overall_score=result.get('overall_score', 5.0),
            core_dispute=result.get('core_dispute', 'Unknown'),
            evidence_quality_pct=result.get('evidence_quality_pct', 50),
            pro_arguments=result.get('pro_arguments', 0),
            con_arguments=result.get('con_arguments', 0),
            pro_strong=result.get('pro_strong', 0),
            con_strong=result.get('con_strong', 0),
            consensus_points=result.get('consensus_points', []),
            contested_points=result.get('contested_points', []),
            unresolved_questions=result.get('unresolved_questions', []),
            red_flags=result.get('red_flags', []),
            recommendation=result.get('recommendation', ''),
            worth_reading=result.get('worth_reading', True),
            must_read_comments=result.get('must_read_comments', []),
            skip_branches=result.get('skip_branches', []),
            reading_time_minutes=result.get('reading_time_minutes', 5),
            optimized_path_minutes=result.get('optimized_path_minutes', 2)
        )

    def analyze(self, thread_data: Dict) -> FullAnalysis:
        """Run complete multi-stage analysis pipeline"""
        print("Starting deep analysis pipeline...", file=sys.stderr)

        metadata = thread_data.get('metadata', {})
        thread_id = metadata.get('id', 'unknown')

        # Stage 1: Extract claims
        claims = self.extract_claims(thread_data)
        print(f"  Found {len(claims)} claims", file=sys.stderr)

        # Stage 2: Map arguments
        arguments = self.map_arguments(thread_data, claims)
        print(f"  Mapped {len(arguments)} arguments", file=sys.stderr)

        # Stage 3: Detect fallacies
        fallacies = self.detect_fallacies(thread_data)
        print(f"  Detected {len(fallacies)} fallacies", file=sys.stderr)

        # Stage 4: Profile rhetoric
        profiles = self.profile_rhetoric(thread_data, fallacies)
        print(f"  Profiled {len(profiles)} participants", file=sys.stderr)

        # Stage 5: Find hidden gems
        hidden_gems = self.find_hidden_gems(thread_data, arguments)
        print(f"  Found {len(hidden_gems)} hidden gems", file=sys.stderr)

        # Stage 6: Detect manipulation
        manipulation = self.detect_manipulation(thread_data)
        print(f"  Detected {len(manipulation)} manipulation alerts", file=sys.stderr)

        # Stage 7: Synthesize verdict
        verdict = self.synthesize_verdict(thread_data, claims, arguments, fallacies, profiles)
        print(f"  Verdict: {verdict.overall_score}/10", file=sys.stderr)

        return FullAnalysis(
            thread_id=thread_id,
            thread_title=metadata.get('title', 'Unknown'),
            subreddit=metadata.get('subreddit', 'unknown'),
            analyzed_at=datetime.utcnow().isoformat() + 'Z',
            verdict=verdict,
            claims=claims,
            arguments=arguments,
            fallacies=fallacies,
            rhetorical_profiles=profiles,
            hidden_gems=hidden_gems,
            manipulation_alerts=manipulation
        )


# ============================================================================
# Reddit Fetcher (simplified version)
# ============================================================================

def fetch_reddit_thread(url: str) -> Dict:
    """Fetch a Reddit thread and return structured data"""
    print(f"Fetching thread: {url}", file=sys.stderr)

    # Normalize URL
    if not url.endswith('.json'):
        url = url.rstrip('/') + '.json'

    # Add limit parameter
    if '?' in url:
        url += '&limit=500'
    else:
        url += '?limit=500'

    ssl_context = ssl.create_default_context(cafile=certifi.where())

    headers = {
        'User-Agent': 'DebateAnalyzer/1.0 (Research Project)'
    }

    req = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(req, context=ssl_context, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Fetch error: {e}", file=sys.stderr)
        raise

    # Parse Reddit's response format
    post = data[0]['data']['children'][0]['data']
    comments_data = data[1]['data']['children']

    # Extract comments recursively
    def extract_comments(comment_list: List, depth: int = 0) -> List[Dict]:
        result = []
        for item in comment_list:
            if item['kind'] != 't1':  # Not a comment
                continue
            c = item['data']
            comment = {
                'id': c.get('id', ''),
                'author': c.get('author', '[deleted]'),
                'body': c.get('body', ''),
                'score': c.get('score', 0),
                'depth': depth,
                'created_utc': c.get('created_utc', 0),
                'controversiality': c.get('controversiality', 0),
                'parent_id': c.get('parent_id', ''),
                'is_op': c.get('author', '') == post.get('author', '')
            }
            result.append(comment)

            # Handle replies
            replies = c.get('replies', '')
            if replies and isinstance(replies, dict):
                children = replies.get('data', {}).get('children', [])
                result.extend(extract_comments(children, depth + 1))

        return result

    comments = extract_comments(comments_data)

    return {
        'metadata': {
            'id': post.get('id', ''),
            'title': post.get('title', ''),
            'subreddit': post.get('subreddit', ''),
            'author': post.get('author', ''),
            'score': post.get('score', 0),
            'upvote_ratio': post.get('upvote_ratio', 0),
            'num_comments': post.get('num_comments', 0),
            'created_utc': post.get('created_utc', 0),
            'selftext': post.get('selftext', ''),
            'url': f"https://reddit.com{post.get('permalink', '')}"
        },
        'comments': comments
    }


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Analyze Reddit debates using GLM-4')
    parser.add_argument('--url', help='Reddit thread URL to analyze')
    parser.add_argument('--input', help='Path to input JSON file with thread data')
    parser.add_argument('--output', '-o', help='Output file path (default: stdout)')
    parser.add_argument('--model', default='glm-4-plus', help='GLM model to use (default: glm-4-plus)')
    parser.add_argument('--api-key', help='ZhipuAI API key (or set ZHIPUAI_API_KEY env var)')

    args = parser.parse_args()

    # Get API key
    api_key = args.api_key or os.environ.get('ZHIPUAI_API_KEY')
    if not api_key:
        print("Error: API key required. Set ZHIPUAI_API_KEY or use --api-key", file=sys.stderr)
        sys.exit(1)

    # Get thread data
    if args.url:
        thread_data = fetch_reddit_thread(args.url)
    elif args.input:
        with open(args.input, 'r') as f:
            thread_data = json.load(f)
    else:
        print("Error: Either --url or --input required", file=sys.stderr)
        sys.exit(1)

    # Run analysis
    analyzer = DebateAnalyzer(api_key, model=args.model)
    analysis = analyzer.analyze(thread_data)

    # Convert to JSON-serializable dict
    def to_dict(obj):
        if hasattr(obj, '__dataclass_fields__'):
            return {k: to_dict(v) for k, v in asdict(obj).items()}
        elif isinstance(obj, list):
            return [to_dict(i) for i in obj]
        elif isinstance(obj, dict):
            return {k: to_dict(v) for k, v in obj.items()}
        else:
            return obj

    result = to_dict(analysis)

    # Output
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Analysis saved to {args.output}", file=sys.stderr)
    else:
        print(json.dumps(result, indent=2))

    print("Analysis complete!", file=sys.stderr)


if __name__ == '__main__':
    main()

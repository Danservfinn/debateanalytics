"""
Debate identification using Claude

Identifies which user comments are part of actual debates vs casual discussion.
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from analysis.claude_client import ClaudeClient
from models.user_profile import DebateThread, DebateMetadata, RedditComment

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert at identifying argumentative debates in online discussions.

Your task is to analyze Reddit comments and determine which are part of substantive debates
(back-and-forth exchanges where people argue different positions) versus casual discussion,
simple Q&A, or agreement without argumentation.

You analyze the structure, content, and context to make accurate classifications.
Always respond with valid JSON matching the requested schema."""


DEBATE_IDENTIFICATION_PROMPT = """Analyze these Reddit comments from user "{username}" and identify which are part of debates.

For each thread, determine:
1. Is this a debate? (argumentative exchange with opposing views)
2. If yes, extract metadata about the debate

A comment IS part of a debate if:
- Contains claim + reasoning (not just assertion)
- Responds to or presents an opposing viewpoint
- Shows back-and-forth exchange pattern
- Attempts to persuade or refute

A comment is NOT a debate if:
- Simple agreement/disagreement without reasoning
- Pure questions without argumentative intent
- Purely informational exchange
- Off-topic or joking
- One-sided statements with no opposition

## Comments to Analyze

{threads_text}

## Required JSON Output

Return a JSON object with this structure:
{{
    "debates": [
        {{
            "thread_id": "abc123",
            "is_debate": true,
            "confidence": 0.92,
            "metadata": {{
                "topic": "Climate policy effectiveness",
                "topic_category": "politics",
                "user_position": "Pro nuclear energy as part of clean energy mix",
                "opponent_position": "Against nuclear, favors renewables only",
                "exchange_depth": 5,
                "is_ongoing": false,
                "apparent_outcome": "unresolved"
            }}
        }},
        {{
            "thread_id": "def456",
            "is_debate": false,
            "confidence": 0.88,
            "reason": "Casual agreement with no opposing views"
        }}
    ]
}}

For apparent_outcome, use one of:
- "user_won" - User's position gained clear advantage (opponent conceded, delta awarded, etc.)
- "opponent_won" - Opponent's position prevailed
- "draw" - Neither side clearly won but reached mutual understanding
- "unresolved" - Debate ended without clear resolution
- "ongoing" - Exchange still continuing

Topic categories should be one of:
politics, technology, science, philosophy, ethics, economics, social, entertainment, sports, other

Analyze all {thread_count} threads and classify each one."""


@dataclass
class DebateIdentificationResult:
    """Result of debate identification"""
    thread_id: str
    is_debate: bool
    confidence: float
    metadata: Optional[DebateMetadata] = None
    reason: Optional[str] = None


class DebateIdentifier:
    """
    Identifies debates in user's comment history using Claude.

    Takes user's comments grouped by thread and determines which
    represent actual debates vs casual discussion.
    """

    def __init__(self, claude_client: ClaudeClient):
        self.client = claude_client

    def _format_thread_for_prompt(
        self,
        thread: DebateThread,
        max_comments: int = 10,
    ) -> str:
        """Format a single thread for the prompt"""
        lines = [
            f"\n=== Thread: {thread.thread_id} ===",
            f"Title: {thread.thread_title[:100]}",
            f"Subreddit: r/{thread.subreddit}",
            f"User is OP: {thread.user_is_op}",
            f"User comment count: {thread.user_comment_count}",
            "",
            "User's comments:",
        ]

        for i, comment in enumerate(thread.user_comments[:max_comments]):
            lines.append(f"  [{comment.id}] (depth: {comment.depth}, score: {comment.score})")
            # Truncate long comments
            body = comment.body[:500]
            if len(comment.body) > 500:
                body += "..."
            lines.append(f"    {body}")
            lines.append("")

        if thread.opponent_comments:
            lines.append("Opponent comments in exchange:")
            for comment in thread.opponent_comments[:5]:
                lines.append(f"  u/{comment.author} [{comment.id}]:")
                body = comment.body[:300]
                if len(comment.body) > 300:
                    body += "..."
                lines.append(f"    {body}")
                lines.append("")

        return "\n".join(lines)

    def identify_debates(
        self,
        username: str,
        threads: List[DebateThread],
        batch_size: int = 10,
    ) -> List[DebateThread]:
        """
        Identify which threads contain debates.

        Args:
            username: The user being analyzed
            threads: List of threads to analyze
            batch_size: Number of threads per Claude call

        Returns:
            Updated DebateThread objects with is_debate and metadata set
        """
        logger.info(f"Identifying debates for u/{username} across {len(threads)} threads")

        results = {}

        # Process in batches
        for i in range(0, len(threads), batch_size):
            batch = threads[i:i + batch_size]
            batch_results = self._analyze_batch(username, batch)

            for result in batch_results:
                results[result.thread_id] = result

        # Update thread objects
        updated_threads = []
        for thread in threads:
            result = results.get(thread.thread_id)
            if result:
                thread.is_debate = result.is_debate
                thread.confidence = result.confidence
                thread.metadata = result.metadata
            updated_threads.append(thread)

        debates_found = sum(1 for t in updated_threads if t.is_debate)
        logger.info(f"Identified {debates_found} debates out of {len(threads)} threads")

        return updated_threads

    def _analyze_batch(
        self,
        username: str,
        threads: List[DebateThread],
    ) -> List[DebateIdentificationResult]:
        """Analyze a batch of threads with Claude"""

        # Format threads for prompt
        threads_text = "\n".join(
            self._format_thread_for_prompt(t) for t in threads
        )

        prompt = DEBATE_IDENTIFICATION_PROMPT.format(
            username=username,
            threads_text=threads_text,
            thread_count=len(threads),
        )

        # Call Claude
        response = self.client.analyze(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )

        # Parse results
        results = []
        for debate_data in response.get("debates", []):
            thread_id = debate_data.get("thread_id", "")
            is_debate = debate_data.get("is_debate", False)
            confidence = debate_data.get("confidence", 0.5)

            metadata = None
            if is_debate and "metadata" in debate_data:
                m = debate_data["metadata"]
                metadata = DebateMetadata(
                    topic=m.get("topic", ""),
                    topic_category=m.get("topic_category", "other"),
                    user_position=m.get("user_position"),
                    opponent_position=m.get("opponent_position"),
                    exchange_depth=m.get("exchange_depth", 0),
                    is_ongoing=m.get("is_ongoing", False),
                    apparent_outcome=m.get("apparent_outcome", "unresolved"),
                )

            results.append(DebateIdentificationResult(
                thread_id=thread_id,
                is_debate=is_debate,
                confidence=confidence,
                metadata=metadata,
                reason=debate_data.get("reason"),
            ))

        return results

    def quick_filter(
        self,
        threads: List[DebateThread],
        min_comments: int = 2,
        min_words: int = 50,
    ) -> List[DebateThread]:
        """
        Quick pre-filter threads before sending to Claude.

        Filters out threads that definitely aren't debates based on
        simple heuristics (saves API calls).

        Args:
            threads: Threads to filter
            min_comments: Minimum user comments in thread
            min_words: Minimum total words from user

        Returns:
            Filtered list of potential debates
        """
        filtered = []
        for thread in threads:
            # Skip if too few comments
            if thread.user_comment_count < min_comments:
                thread.is_debate = False
                thread.confidence = 0.9
                continue

            # Skip if too few words
            if thread.total_words < min_words:
                thread.is_debate = False
                thread.confidence = 0.85
                continue

            # Skip if no back-and-forth (all top-level)
            if thread.user_comment_count > 1:
                depths = [c.depth for c in thread.user_comments]
                if max(depths) == 0:
                    # All top-level comments, likely not a debate
                    thread.is_debate = False
                    thread.confidence = 0.7
                    continue

            filtered.append(thread)

        logger.info(f"Quick filter: {len(filtered)}/{len(threads)} threads passed")
        return filtered

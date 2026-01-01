"""
Argument quality analysis using Claude

Analyzes individual debates for argument quality, structure, evidence, and more.
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from .claude_client import ClaudeClient
from ..models.user_profile import (
    DebateThread,
    ArgumentQuality,
    FallacyInstance,
    FallacyType,
    FallacySeverity,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert rhetoric and argumentation analyst.

You analyze online debates with precision, evaluating:
- Logical structure and reasoning quality
- Evidence usage and citation quality
- Counterargument engagement
- Persuasiveness and outcomes
- Civility and tone
- Logical fallacies

You provide objective, balanced assessments that help understand debate quality.
Always respond with valid JSON matching the requested schema."""


ARGUMENT_QUALITY_PROMPT = """Analyze the argument quality in this debate exchange.

## Debate Context
- Thread: {thread_title}
- Subreddit: r/{subreddit}
- Topic: {topic}
- User position: {user_position}
- Opponent position: {opponent_position}

## User's Arguments
{user_comments}

## Opponent's Arguments (for context)
{opponent_comments}

## Analysis Required

Evaluate the USER's argumentation quality across these dimensions:

1. **Structure (0-100)**: Logical organization, clear thesis, premise-conclusion chains
2. **Evidence (0-100)**: Citation frequency, source quality, proper contextualization
3. **Counterargument Engagement (0-100)**: Addresses opponent points, steelmans vs strawmans
4. **Persuasiveness (0-100)**: Effectiveness at making case, any mind-changing
5. **Civility (0-100)**: Respectful tone, no personal attacks

Also identify any logical fallacies committed by the user.

## Required JSON Output

{{
    "debate_id": "{thread_id}",
    "overall_score": 78,

    "structure": {{
        "score": 82,
        "has_clear_thesis": true,
        "premises_support_conclusion": true,
        "logical_flow": "strong",
        "notes": "Well-organized with numbered points"
    }},

    "evidence": {{
        "score": 75,
        "citation_count": 2,
        "citation_quality": "medium",
        "citations": [
            {{
                "claim": "The claim being supported",
                "source": "Source cited",
                "source_type": "academic|journalistic|primary|anecdotal",
                "properly_contextualized": true
            }}
        ],
        "notes": "Good use of data, could use more primary sources"
    }},

    "counterargument_engagement": {{
        "score": 70,
        "addresses_opponent_points": true,
        "steelmans_opponent": false,
        "strawmans_opponent": false,
        "missed_points": ["Did not address the cost argument"],
        "notes": "Engages most points but missed one key objection"
    }},

    "persuasiveness": {{
        "score": 85,
        "changed_opponent_mind": true,
        "opponent_concession_quote": "You make a good point about...",
        "effective_techniques": ["data-first opening", "systematic breakdown"],
        "notes": "Successfully shifted opponent's view"
    }},

    "civility": {{
        "score": 95,
        "personal_attacks": false,
        "condescension": false,
        "notes": "Maintained professional tone"
    }},

    "fallacies": [
        {{
            "type": "hasty_generalization",
            "confidence": 0.75,
            "severity": "minor",
            "user_statement": "All companies saw productivity gains",
            "explanation": "Overgeneralizes from limited examples"
        }}
    ],

    "is_top_argument_candidate": true,
    "top_argument_reasons": [
        "Strong evidence usage",
        "Changed opponent's mind"
    ]
}}

Fallacy types: ad_hominem, strawman, false_dichotomy, appeal_to_authority, appeal_to_emotion,
hasty_generalization, slippery_slope, red_herring, circular_reasoning, moving_goalposts,
no_true_scotsman, whataboutism, false_cause, appeal_to_nature, sealioning, gish_gallop

Severity levels: minor, moderate, significant, severe"""


class ArgumentAnalyzer:
    """
    Analyzes argument quality in debates using Claude.

    Evaluates structure, evidence, engagement, persuasiveness, and civility.
    Also detects logical fallacies.
    """

    def __init__(self, claude_client: ClaudeClient):
        self.client = claude_client

    def _format_comments(
        self,
        comments: List[Any],
        max_comments: int = 10,
        max_chars: int = 800,
    ) -> str:
        """Format comments for prompt"""
        lines = []
        for i, comment in enumerate(comments[:max_comments]):
            body = comment.body[:max_chars]
            if len(comment.body) > max_chars:
                body += "..."

            lines.append(f"[{comment.id}] (depth: {comment.depth}, score: {comment.score})")
            lines.append(f"{body}")
            lines.append("")

        return "\n".join(lines)

    def analyze_debate(
        self,
        thread: DebateThread,
    ) -> ArgumentQuality:
        """
        Analyze argument quality for a single debate.

        Args:
            thread: The debate thread to analyze

        Returns:
            ArgumentQuality assessment
        """
        logger.debug(f"Analyzing argument quality for thread {thread.thread_id}")

        # Extract metadata
        topic = thread.metadata.topic if thread.metadata else "Unknown"
        user_position = thread.metadata.user_position if thread.metadata else "Unknown"
        opponent_position = thread.metadata.opponent_position if thread.metadata else "Unknown"

        # Format comments
        user_comments = self._format_comments(thread.user_comments)
        opponent_comments = self._format_comments(thread.opponent_comments) if thread.opponent_comments else "No opponent comments available"

        prompt = ARGUMENT_QUALITY_PROMPT.format(
            thread_title=thread.thread_title[:100],
            subreddit=thread.subreddit,
            topic=topic,
            user_position=user_position,
            opponent_position=opponent_position,
            user_comments=user_comments,
            opponent_comments=opponent_comments,
            thread_id=thread.thread_id,
        )

        # Call Claude
        response = self.client.analyze(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )

        # Parse response
        return self._parse_quality_response(response, thread.thread_id)

    def _parse_quality_response(
        self,
        response: Dict,
        thread_id: str,
    ) -> ArgumentQuality:
        """Parse Claude's response into ArgumentQuality"""

        structure = response.get("structure", {})
        evidence = response.get("evidence", {})
        counter = response.get("counterargument_engagement", {})
        persuasion = response.get("persuasiveness", {})
        civility = response.get("civility", {})

        # Parse citations
        citations = []
        for c in evidence.get("citations", []):
            citations.append({
                "claim": c.get("claim", ""),
                "source": c.get("source", ""),
                "source_type": c.get("source_type", "unknown"),
                "properly_contextualized": c.get("properly_contextualized", False),
            })

        return ArgumentQuality(
            debate_id=thread_id,
            overall_score=response.get("overall_score", 50),

            structure_score=structure.get("score", 50),
            structure_notes=structure.get("notes", ""),

            evidence_score=evidence.get("score", 50),
            evidence_notes=evidence.get("notes", ""),
            citation_count=evidence.get("citation_count", 0),
            citations=citations,

            counterargument_score=counter.get("score", 50),
            counterargument_notes=counter.get("notes", ""),
            addresses_opponent_points=counter.get("addresses_opponent_points", False),
            steelmans_opponent=counter.get("steelmans_opponent", False),
            strawmans_opponent=counter.get("strawmans_opponent", False),

            persuasiveness_score=persuasion.get("score", 50),
            changed_opponent_mind=persuasion.get("changed_opponent_mind", False),
            opponent_concession_quote=persuasion.get("opponent_concession_quote"),

            civility_score=civility.get("score", 50),
            personal_attacks=civility.get("personal_attacks", False),
            condescension=civility.get("condescension", False),

            is_top_argument_candidate=response.get("is_top_argument_candidate", False),
            top_argument_reasons=response.get("top_argument_reasons", []),
        )

    def analyze_debates_batch(
        self,
        threads: List[DebateThread],
    ) -> Dict[str, ArgumentQuality]:
        """
        Analyze multiple debates.

        Args:
            threads: List of debate threads to analyze

        Returns:
            Dict mapping thread_id to ArgumentQuality
        """
        results = {}

        for thread in threads:
            if not thread.is_debate:
                continue

            try:
                quality = self.analyze_debate(thread)
                results[thread.thread_id] = quality
            except Exception as e:
                logger.error(f"Error analyzing thread {thread.thread_id}: {e}")
                continue

        logger.info(f"Analyzed argument quality for {len(results)} debates")
        return results

    def extract_fallacies(
        self,
        threads: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> List[FallacyInstance]:
        """
        Extract all fallacy instances from quality analysis.

        This is a separate pass that collects all detected fallacies
        with full context for the fallacy profile section.
        """
        # For now, fallacies are detected during quality analysis
        # This method would do a separate, more detailed fallacy analysis
        # TODO: Implement detailed fallacy analysis with opponent context

        logger.info("Fallacy extraction not yet implemented separately")
        return []

    def calculate_overall_score(
        self,
        quality: ArgumentQuality,
        weights: Optional[Dict[str, float]] = None,
    ) -> int:
        """
        Calculate weighted overall score from dimensions.

        Args:
            quality: The ArgumentQuality to score
            weights: Optional custom weights

        Returns:
            Overall score 0-100
        """
        if weights is None:
            weights = {
                "structure": 0.20,
                "evidence": 0.25,
                "counterargument": 0.20,
                "persuasiveness": 0.20,
                "civility": 0.15,
            }

        score = (
            quality.structure_score * weights["structure"] +
            quality.evidence_score * weights["evidence"] +
            quality.counterargument_score * weights["counterargument"] +
            quality.persuasiveness_score * weights["persuasiveness"] +
            quality.civility_score * weights["civility"]
        )

        return int(round(score))

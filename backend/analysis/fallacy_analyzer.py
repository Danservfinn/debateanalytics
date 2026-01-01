"""
Fallacy detection and analysis using Claude

Identifies logical fallacies in user arguments with:
- Specific instance detection
- Severity classification
- Pattern analysis across debates
- Trend identification
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from collections import defaultdict

from .claude_client import ClaudeClient
from ..models.user_profile import (
    DebateThread,
    FallacyInstance,
    FallacyType,
    FallacySeverity,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert in logic, critical thinking, and informal fallacies.

You identify logical fallacies in online debates with precision, distinguishing between:
- Clear fallacies (high confidence)
- Borderline cases (medium confidence)
- Stylistic choices that aren't true fallacies

You understand that colloquial speech often uses rhetorical shortcuts that aren't
technically fallacious in context. You focus on substantive logical errors that
actually weaken arguments.

Always respond with valid JSON matching the requested schema."""


FALLACY_DETECTION_PROMPT = """Analyze this debate for logical fallacies committed by the user.

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

## Fallacy Analysis Required

Identify ALL logical fallacies in the USER's arguments. For each fallacy found:

1. **Type**: Classify the fallacy type
2. **Confidence**: How certain are you this is a fallacy? (0.0-1.0)
3. **Severity**: How much does it weaken the argument?
4. **Quote**: The exact user statement containing the fallacy
5. **Explanation**: Why this is a fallacy
6. **Context**: What the user was responding to (helps assess intent)

## Fallacy Taxonomy

**Relevance Fallacies** (argument doesn't support conclusion):
- ad_hominem: Attacking the person instead of their argument
- strawman: Misrepresenting opponent's position to attack it
- red_herring: Introducing irrelevant topic to distract
- appeal_to_authority: Citing authority without relevant expertise
- appeal_to_emotion: Using emotion instead of logic
- appeal_to_nature: Claiming natural = good/right
- appeal_to_tradition: Claiming old = good/right
- tu_quoque: "You do it too" deflection
- whataboutism: Deflecting with unrelated counteraccusation
- genetic_fallacy: Judging argument by its origin

**Presumption Fallacies** (assumes what needs to be proven):
- begging_the_question: Circular reasoning, conclusion in premises
- false_dichotomy: Presenting only two options when more exist
- loaded_question: Question that presupposes contested claim
- no_true_scotsman: Redefining group to exclude counterexamples
- hasty_generalization: Generalizing from insufficient examples
- slippery_slope: Claiming inevitable chain without evidence
- false_cause: Assuming correlation = causation
- post_hoc: Assuming sequence = causation

**Ambiguity Fallacies** (exploits unclear language):
- equivocation: Using same word with different meanings
- amphiboly: Using ambiguous grammar
- accent: Emphasis changes meaning
- composition: What's true of parts must be true of whole
- division: What's true of whole must be true of parts

**Bad Faith Tactics** (deliberate rhetorical manipulation):
- moving_goalposts: Changing criteria when original met
- sealioning: Persistent bad-faith questioning
- gish_gallop: Overwhelming with many weak arguments
- motte_and_bailey: Switching between defensible and indefensible claims
- kafka_trap: Denial of accusation used as proof of it

## Required JSON Output

{{
    "thread_id": "{thread_id}",
    "fallacies_detected": [
        {{
            "type": "strawman",
            "confidence": 0.85,
            "severity": "moderate",
            "user_statement": "So you're saying we should just let everyone starve?",
            "opponent_context": "I suggested reducing food stamp eligibility slightly",
            "explanation": "Exaggerates opponent's position to an extreme they didn't advocate",
            "comment_id": "abc123",
            "is_pattern": false
        }},
        {{
            "type": "ad_hominem",
            "confidence": 0.72,
            "severity": "minor",
            "user_statement": "Of course you'd say that, you post in r/conservative",
            "opponent_context": "Made an argument about fiscal policy",
            "explanation": "Dismisses argument based on opponent's subreddit history",
            "comment_id": "def456",
            "is_pattern": false
        }}
    ],
    "overall_fallacy_density": "low",
    "most_common_type": "strawman",
    "notes": "User generally argues in good faith with occasional rhetorical overreach"
}}

Severity levels:
- minor: Slight logical weakness, doesn't fundamentally undermine argument
- moderate: Notable flaw that weakens the argument
- significant: Serious logical error that substantially weakens argument
- severe: Argument relies primarily on the fallacy

Fallacy density:
- none: No fallacies detected
- low: 1-2 minor fallacies
- moderate: Multiple fallacies or some significant ones
- high: Frequent fallacies throughout
- very_high: Arguments primarily consist of fallacies

Be precise. Only flag clear fallacies, not mere rhetorical flourishes or valid arguments
you personally disagree with."""


@dataclass
class FallacyAnalysisResult:
    """Result of fallacy analysis for a single debate"""
    thread_id: str
    fallacies: List[FallacyInstance]
    fallacy_density: str
    most_common_type: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class FallacyProfile:
    """Aggregate fallacy profile across all debates"""
    total_fallacies: int = 0
    fallacy_counts: Dict[str, int] = field(default_factory=dict)
    fallacy_by_severity: Dict[str, int] = field(default_factory=dict)
    ranked_fallacies: List[Dict] = field(default_factory=list)
    instances: List[FallacyInstance] = field(default_factory=list)
    avg_density: str = "low"
    trend: str = "stable"
    notes: str = ""


class FallacyAnalyzer:
    """
    Analyzes debates for logical fallacies using Claude.

    Detects, classifies, and ranks fallacies with linked instances.
    """

    def __init__(self, claude_client: ClaudeClient):
        self.client = claude_client

    def _format_comments(
        self,
        comments: List[Any],
        max_comments: int = 10,
        max_chars: int = 600,
    ) -> str:
        """Format comments for prompt"""
        lines = []
        for i, comment in enumerate(comments[:max_comments]):
            body = comment.body[:max_chars]
            if len(comment.body) > max_chars:
                body += "..."

            lines.append(f"[{comment.id}] (depth: {comment.depth})")
            lines.append(f"{body}")
            lines.append("")

        return "\n".join(lines)

    def analyze_debate(
        self,
        thread: DebateThread,
    ) -> FallacyAnalysisResult:
        """
        Analyze a single debate for fallacies.

        Args:
            thread: The debate thread to analyze

        Returns:
            FallacyAnalysisResult with detected fallacies
        """
        logger.debug(f"Analyzing fallacies in thread {thread.thread_id}")

        # Extract metadata
        topic = thread.metadata.topic if thread.metadata else "Unknown"
        user_position = thread.metadata.user_position if thread.metadata else "Unknown"
        opponent_position = thread.metadata.opponent_position if thread.metadata else "Unknown"

        # Format comments
        user_comments = self._format_comments(thread.user_comments)
        opponent_comments = (
            self._format_comments(thread.opponent_comments)
            if thread.opponent_comments
            else "No opponent comments available"
        )

        prompt = FALLACY_DETECTION_PROMPT.format(
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
        return self._parse_fallacy_response(response, thread.thread_id)

    def _parse_fallacy_response(
        self,
        response: Dict,
        thread_id: str,
    ) -> FallacyAnalysisResult:
        """Parse Claude's fallacy detection response"""

        fallacies = []
        for f in response.get("fallacies_detected", []):
            try:
                fallacy_type = FallacyType(f.get("type", "other"))
            except ValueError:
                fallacy_type = FallacyType.OTHER

            try:
                severity = FallacySeverity(f.get("severity", "minor"))
            except ValueError:
                severity = FallacySeverity.MINOR

            fallacies.append(FallacyInstance(
                fallacy_type=fallacy_type,
                confidence=f.get("confidence", 0.5),
                severity=severity,
                user_statement=f.get("user_statement", ""),
                opponent_context=f.get("opponent_context"),
                explanation=f.get("explanation", ""),
                debate_id=thread_id,
                comment_id=f.get("comment_id"),
                is_pattern=f.get("is_pattern", False),
            ))

        return FallacyAnalysisResult(
            thread_id=thread_id,
            fallacies=fallacies,
            fallacy_density=response.get("overall_fallacy_density", "low"),
            most_common_type=response.get("most_common_type"),
            notes=response.get("notes"),
        )

    def analyze_debates_batch(
        self,
        threads: List[DebateThread],
    ) -> Dict[str, FallacyAnalysisResult]:
        """
        Analyze multiple debates for fallacies.

        Args:
            threads: List of debate threads to analyze

        Returns:
            Dict mapping thread_id to FallacyAnalysisResult
        """
        results = {}

        for thread in threads:
            if not thread.is_debate:
                continue

            try:
                result = self.analyze_debate(thread)
                results[thread.thread_id] = result
            except Exception as e:
                logger.error(f"Error analyzing thread {thread.thread_id}: {e}")
                continue

        logger.info(f"Analyzed fallacies in {len(results)} debates")
        return results

    def build_fallacy_profile(
        self,
        analysis_results: Dict[str, FallacyAnalysisResult],
    ) -> FallacyProfile:
        """
        Build aggregate fallacy profile from analysis results.

        Args:
            analysis_results: Dict of thread_id to FallacyAnalysisResult

        Returns:
            FallacyProfile with ranked fallacies and statistics
        """
        profile = FallacyProfile()

        # Collect all fallacies
        all_fallacies: List[FallacyInstance] = []
        type_counts: Dict[str, int] = defaultdict(int)
        severity_counts: Dict[str, int] = defaultdict(int)
        density_values = []

        density_map = {
            "none": 0,
            "low": 1,
            "moderate": 2,
            "high": 3,
            "very_high": 4,
        }

        for result in analysis_results.values():
            all_fallacies.extend(result.fallacies)
            density_values.append(density_map.get(result.fallacy_density, 1))

            for fallacy in result.fallacies:
                type_counts[fallacy.fallacy_type.value] += 1
                severity_counts[fallacy.severity.value] += 1

        profile.total_fallacies = len(all_fallacies)
        profile.fallacy_counts = dict(type_counts)
        profile.fallacy_by_severity = dict(severity_counts)
        profile.instances = all_fallacies

        # Calculate average density
        if density_values:
            avg_density = sum(density_values) / len(density_values)
            if avg_density < 0.5:
                profile.avg_density = "none"
            elif avg_density < 1.5:
                profile.avg_density = "low"
            elif avg_density < 2.5:
                profile.avg_density = "moderate"
            elif avg_density < 3.5:
                profile.avg_density = "high"
            else:
                profile.avg_density = "very_high"

        # Build ranked fallacy list
        ranked = []
        for fallacy_type, count in sorted(
            type_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        ):
            # Get instances of this type
            instances = [
                f for f in all_fallacies
                if f.fallacy_type.value == fallacy_type
            ]

            # Calculate average severity
            severity_scores = {
                "minor": 1,
                "moderate": 2,
                "significant": 3,
                "severe": 4,
            }
            avg_severity = sum(
                severity_scores.get(f.severity.value, 1) for f in instances
            ) / len(instances) if instances else 1

            ranked.append({
                "fallacy_type": fallacy_type,
                "count": count,
                "percentage": round(count / profile.total_fallacies * 100, 1) if profile.total_fallacies else 0,
                "avg_severity": round(avg_severity, 2),
                "instances": [
                    {
                        "debate_id": f.debate_id,
                        "comment_id": f.comment_id,
                        "statement": f.user_statement[:200],
                        "explanation": f.explanation,
                        "severity": f.severity.value,
                        "confidence": f.confidence,
                    }
                    for f in instances[:5]  # Top 5 instances
                ],
            })

        profile.ranked_fallacies = ranked

        # Generate notes
        if profile.total_fallacies == 0:
            profile.notes = "No logical fallacies detected in analyzed debates."
        elif profile.avg_density == "low":
            profile.notes = "Occasional logical missteps but generally sound reasoning."
        elif profile.avg_density == "moderate":
            profile.notes = "Regular use of fallacious reasoning weakens overall argument quality."
        else:
            profile.notes = "Frequent fallacies significantly undermine argument credibility."

        return profile

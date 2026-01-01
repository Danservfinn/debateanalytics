"""
Top Arguments extraction and ranking using Claude

Identifies and ranks the user's best arguments with:
- Quality scoring across multiple dimensions
- Snippet extraction with context
- Category classification
- Signature technique identification
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

from analysis.claude_client import ClaudeClient
from models.user_profile import (
    DebateThread,
    ArgumentQuality,
    TopArgument,
    ArgumentCategory,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert debate coach and rhetoric analyst.

You identify exceptional arguments that demonstrate:
- Strong logical structure
- Effective use of evidence
- Persuasive technique
- Clear communication
- Intellectual honesty

You can identify signature techniques and categorize arguments by their strengths.

Always respond with valid JSON matching the requested schema."""


TOP_ARGUMENTS_PROMPT = """Identify the TOP ARGUMENTS from this user's debate history.

## User: u/{username}

## Debates with Quality Scores

{debate_details}

## Selection Criteria

Identify arguments that excel in one or more categories:

### Categories

**MOST_PERSUASIVE** 🎯
- Changed opponent's mind or got concessions
- Effective rhetorical structure
- Clear, compelling presentation

**BEST_EVIDENCED** 📚
- Strong citations and sources
- Well-contextualized data
- Proper use of expert opinion

**BEST_STRUCTURED** 🏗️
- Clear logical flow
- Well-organized premises
- Explicit reasoning chains

**MOST_CIVIL** 🤝
- Maintained respect under pressure
- Steelmanned opponent's position
- Productive dialogue despite disagreement

**MOST_ORIGINAL** 💡
- Novel perspective or framing
- Creative analogies
- Unique insight

**MOST_CONCISE** ⚡
- Maximum impact with minimum words
- Elegant simplification
- Clear distillation of complex ideas

## Required JSON Output

{{
    "username": "{username}",
    "top_arguments": [
        {{
            "rank": 1,
            "debate_id": "thread123",
            "category": "most_persuasive",
            "title": "The Economic Case for Remote Work",
            "snippet": "The productivity data from Stanford's 2-year study shows a 13% performance increase for remote workers, while companies saved $2,000 per employee annually. This isn't about preference—it's about measurable outcomes.",
            "full_context": {{
                "subreddit": "economics",
                "thread_title": "Remote work is less productive than office work",
                "opponent_position": "Remote work hurts collaboration and productivity",
                "outcome": "Opponent conceded the productivity point"
            }},
            "quality_breakdown": {{
                "structure": 85,
                "evidence": 92,
                "persuasiveness": 88,
                "civility": 90
            }},
            "why_exceptional": "Combined hard data with clear cost-benefit analysis, directly addressing the opponent's core claim",
            "techniques_used": ["data-first opening", "quantified claims", "direct rebuttal"]
        }},
        {{
            "rank": 2,
            "debate_id": "thread456",
            "category": "best_structured",
            "title": "Breaking Down the Free Will Paradox",
            "snippet": "Let's separate three distinct claims: (1) determinism is true, (2) free will requires the ability to do otherwise, (3) moral responsibility requires free will. You're conflating all three, but each requires separate defense.",
            "full_context": {{
                "subreddit": "philosophy",
                "thread_title": "Free will is an illusion",
                "opponent_position": "Determinism means no one is responsible for anything",
                "outcome": "Thread evolved into productive philosophical exchange"
            }},
            "quality_breakdown": {{
                "structure": 95,
                "evidence": 70,
                "persuasiveness": 82,
                "civility": 88
            }},
            "why_exceptional": "Masterfully decomposed a complex philosophical debate into addressable components",
            "techniques_used": ["argument decomposition", "numbered premises", "scope clarification"]
        }}
    ],
    "signature_techniques": [
        {{
            "technique": "Data-First Opening",
            "description": "Opens arguments with specific statistics or studies before making claims",
            "frequency": "high",
            "effectiveness": "Very effective for establishing credibility"
        }},
        {{
            "technique": "Premise Numbering",
            "description": "Explicitly numbers and separates argument components",
            "frequency": "moderate",
            "effectiveness": "Helps opponents engage with specific points"
        }}
    ],
    "argument_stats": {{
        "total_top_arguments": 8,
        "by_category": {{
            "most_persuasive": 3,
            "best_evidenced": 2,
            "best_structured": 2,
            "most_civil": 1
        }},
        "avg_quality_score": 84
    }}
}}

Select up to 10 top arguments, prioritizing diversity across categories.
For each argument, extract the BEST snippet (50-200 words) that showcases why it's exceptional."""


@dataclass
class TopArgumentsResult:
    """Result of top arguments extraction"""
    top_arguments: List[TopArgument]
    signature_techniques: List[Dict[str, Any]]
    argument_stats: Dict[str, Any]


class TopArgumentsAnalyzer:
    """
    Extracts and ranks top arguments from debate history.
    """

    def __init__(self, claude_client: ClaudeClient):
        self.client = claude_client

    def _format_debate_details(
        self,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
        max_debates: int = 20,
    ) -> str:
        """Format debate details for analysis"""
        lines = []

        # Sort by quality score
        sorted_debates = sorted(
            debates,
            key=lambda d: quality_results.get(d.thread_id, ArgumentQuality(debate_id=d.thread_id)).overall_score,
            reverse=True,
        )

        for debate in sorted_debates[:max_debates]:
            quality = quality_results.get(debate.thread_id)

            lines.append(f"\n### Thread: {debate.thread_id}")
            lines.append(f"Subreddit: r/{debate.subreddit}")
            lines.append(f"Title: {debate.thread_title[:100]}")

            if debate.metadata:
                lines.append(f"Topic: {debate.metadata.topic}")
                lines.append(f"User Position: {debate.metadata.user_position}")
                lines.append(f"Opponent Position: {debate.metadata.opponent_position}")
                lines.append(f"Outcome: {debate.metadata.apparent_outcome}")

            if quality:
                lines.append(f"Quality Scores:")
                lines.append(f"  Overall: {quality.overall_score}")
                lines.append(f"  Structure: {quality.structure_score}")
                lines.append(f"  Evidence: {quality.evidence_score}")
                lines.append(f"  Counterargument: {quality.counterargument_score}")
                lines.append(f"  Persuasiveness: {quality.persuasiveness_score}")
                lines.append(f"  Civility: {quality.civility_score}")

                if quality.changed_opponent_mind:
                    lines.append(f"  ✓ Changed opponent's mind")
                if quality.opponent_concession_quote:
                    lines.append(f"  Concession: \"{quality.opponent_concession_quote[:100]}\"")
                if quality.is_top_argument_candidate:
                    lines.append(f"  ⭐ Marked as top argument candidate")

            lines.append("\nUser Comments:")
            for i, comment in enumerate(debate.user_comments[:3]):
                body = comment.body[:500]
                if len(comment.body) > 500:
                    body += "..."
                lines.append(f"[{comment.id}] {body}")
                lines.append("")

        return "\n".join(lines)

    def extract_top_arguments(
        self,
        username: str,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> TopArgumentsResult:
        """
        Extract and rank top arguments.

        Args:
            username: Reddit username
            debates: List of debate threads
            quality_results: Quality analysis results

        Returns:
            TopArgumentsResult with ranked arguments
        """
        logger.info(f"Extracting top arguments for u/{username}")

        debate_details = self._format_debate_details(debates, quality_results)

        prompt = TOP_ARGUMENTS_PROMPT.format(
            username=username,
            debate_details=debate_details,
        )

        response = self.client.analyze(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )

        return self._parse_response(response)

    def _parse_response(self, response: Dict) -> TopArgumentsResult:
        """Parse top arguments response"""

        top_arguments = []
        for arg_data in response.get("top_arguments", []):
            try:
                category = ArgumentCategory(arg_data.get("category", "most_persuasive"))
            except ValueError:
                category = ArgumentCategory.MOST_PERSUASIVE

            context = arg_data.get("full_context", {})
            quality = arg_data.get("quality_breakdown", {})

            top_arguments.append(TopArgument(
                rank=arg_data.get("rank", len(top_arguments) + 1),
                debate_id=arg_data.get("debate_id", ""),
                category=category,
                title=arg_data.get("title", ""),
                snippet=arg_data.get("snippet", ""),
                subreddit=context.get("subreddit", ""),
                thread_title=context.get("thread_title", ""),
                opponent_position=context.get("opponent_position"),
                outcome=context.get("outcome"),
                structure_score=quality.get("structure", 0),
                evidence_score=quality.get("evidence", 0),
                persuasiveness_score=quality.get("persuasiveness", 0),
                civility_score=quality.get("civility", 0),
                why_exceptional=arg_data.get("why_exceptional", ""),
                techniques_used=arg_data.get("techniques_used", []),
            ))

        return TopArgumentsResult(
            top_arguments=top_arguments,
            signature_techniques=response.get("signature_techniques", []),
            argument_stats=response.get("argument_stats", {}),
        )

    def get_arguments_by_category(
        self,
        top_arguments: List[TopArgument],
        category: ArgumentCategory,
    ) -> List[TopArgument]:
        """Filter arguments by category"""
        return [arg for arg in top_arguments if arg.category == category]

    def get_signature_techniques(
        self,
        top_arguments: List[TopArgument],
    ) -> Dict[str, int]:
        """Extract technique frequency from top arguments"""
        technique_counts: Dict[str, int] = {}

        for arg in top_arguments:
            for technique in arg.techniques_used:
                technique_counts[technique] = technique_counts.get(technique, 0) + 1

        return dict(sorted(
            technique_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        ))

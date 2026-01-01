"""
Debate archetype and MBTI classification using Claude

Analyzes debate patterns to infer:
- Primary debate archetype (Professor, Socratic, Analyst, etc.)
- Secondary archetype tendencies
- MBTI-style cognitive preferences from debate behavior
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from .claude_client import ClaudeClient
from ..models.user_profile import (
    DebateThread,
    ArgumentQuality,
    Archetype,
    ArchetypeType,
    MBTIAssessment,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert in argumentation theory, personality psychology, and debate coaching.

You analyze debate patterns to identify:
1. Debate archetypes - characteristic styles of argumentation
2. Cognitive preferences - how debaters process and present information

You base assessments on observable behavior, not speculation. You identify patterns
across multiple debates rather than isolated incidents.

Always respond with valid JSON matching the requested schema."""


ARCHETYPE_PROMPT = """Analyze this debater's style across their debates to determine their archetype.

## Debater: u/{username}

## Debate Summaries

{debate_summaries}

## Quality Metrics Summary
- Average Structure Score: {avg_structure}
- Average Evidence Score: {avg_evidence}
- Average Counterargument Score: {avg_counterargument}
- Average Persuasiveness Score: {avg_persuasiveness}
- Average Civility Score: {avg_civility}
- Total Debates Analyzed: {total_debates}

## Archetype Classification

Classify the debater into one PRIMARY archetype and up to two SECONDARY tendencies.

### Archetype Definitions

**THE PROFESSOR** 📚
- Leads with data, citations, and scholarly references
- Structures arguments academically
- Values accuracy and precision over rhetorical flourish
- Signals: High evidence scores, academic language, source citations

**THE SOCRATIC** 🎯
- Uses questions to guide opponents to contradictions
- Rarely makes direct assertions
- Draws out implications rather than stating conclusions
- Signals: Question-heavy style, high counterargument engagement

**THE ANALYST** 🔍
- Breaks down arguments into component parts
- Identifies logical structure and tests each premise
- Systematic, methodical approach
- Signals: High structure scores, numbered points, "let's break this down"

**THE ADVOCATE** 🔥
- Argues with passion and conviction
- Strong moral framing
- Persuasive and engaging style
- Signals: High persuasiveness, emotional appeals, clear position-taking

**THE PHILOSOPHER** 🤔
- Explores underlying assumptions and first principles
- Comfortable with abstraction and hypotheticals
- Questions definitions and frameworks
- Signals: Abstract language, "what do you mean by...", thought experiments

**THE DIPLOMAT** 🤝
- Seeks common ground and synthesis
- Acknowledges valid points on both sides
- Bridge-building communication style
- Signals: High civility, steelmanning, "I see your point but..."

**THE CONTRARIAN** ⚡
- Takes opposing views to challenge consensus
- Devil's advocate approach
- Tests ideas through opposition
- Signals: Counter-positioning, "actually...", challenging popular views

**THE EMPIRICIST** 📊
- Relies on real-world examples and case studies
- Prefers concrete over abstract
- Experience-based argumentation
- Signals: Anecdotes, case studies, "in practice...", data over theory

## Required JSON Output

{{
    "username": "{username}",
    "primary_archetype": {{
        "type": "professor",
        "confidence": 0.82,
        "evidence": [
            "Consistently cites academic sources",
            "Uses formal argument structure",
            "High evidence scores across debates"
        ]
    }},
    "secondary_archetypes": [
        {{
            "type": "analyst",
            "confidence": 0.65,
            "evidence": ["Frequently breaks down arguments into numbered points"]
        }}
    ],
    "archetype_blend": "Professor-Analyst: Academic rigor with systematic breakdown",
    "style_description": "A methodical debater who leads with evidence and structures arguments clearly. Prefers factual precision over emotional appeal.",
    "signature_moves": [
        "Opens with data or citations",
        "Uses numbered lists for clarity",
        "Acknowledges counterevidence before addressing it"
    ],
    "potential_blindspots": [
        "May come across as condescending",
        "Sometimes over-relies on authority",
        "Could engage more with emotional aspects"
    ]
}}

Archetype types must be one of: professor, socratic, analyst, advocate, philosopher, diplomat, contrarian, empiricist, generalist"""


MBTI_PROMPT = """Analyze this debater's cognitive patterns to infer MBTI-style preferences.

## Debater: u/{username}

## Debate Behavior Patterns

{behavior_patterns}

## MBTI Inference from Debate Behavior

Analyze each cognitive dimension based on OBSERVABLE debate behavior:

### E/I - Extraversion vs Introversion (Information Engagement)
**Extraversion signals in debate:**
- Responds quickly to many threads
- Engages broadly across topics
- Builds on others' ideas collaboratively
- Higher comment volume, shorter exchanges

**Introversion signals in debate:**
- Deeper engagement with fewer threads
- Develops ideas fully before responding
- More self-contained arguments
- Lower volume, longer exchanges

### S/N - Sensing vs Intuition (Information Processing)
**Sensing signals in debate:**
- Focuses on concrete facts and examples
- Practical, real-world applications
- Step-by-step reasoning
- "What actually happened" focus

**Intuition signals in debate:**
- Focuses on patterns and implications
- Abstract principles and theories
- Leaps between ideas
- "What could this mean" focus

### T/F - Thinking vs Feeling (Decision Criteria)
**Thinking signals in debate:**
- Logic-first argumentation
- Impersonal analysis
- Consistency and fairness principles
- Comfortable with conflict

**Feeling signals in debate:**
- Values-first argumentation
- Personal impact consideration
- Harmony and relationship preservation
- Conflict-averse adaptation

### J/P - Judging vs Perceiving (Argument Closure)
**Judging signals in debate:**
- Drives toward conclusions
- Structured argument presentation
- Decisive stance-taking
- Wants to "resolve" debates

**Perceiving signals in debate:**
- Explores multiple angles
- Flexible argument adaptation
- Comfortable with ambiguity
- Keeps options open

## Required JSON Output

{{
    "username": "{username}",
    "mbti_type": "INTJ",
    "confidence": 0.72,
    "dimension_analysis": {{
        "E_I": {{
            "preference": "I",
            "confidence": 0.78,
            "evidence": [
                "Engages deeply with fewer threads rather than broadly",
                "Develops comprehensive arguments before posting"
            ]
        }},
        "S_N": {{
            "preference": "N",
            "confidence": 0.81,
            "evidence": [
                "Frequently discusses theoretical implications",
                "Makes conceptual leaps between ideas"
            ]
        }},
        "T_F": {{
            "preference": "T",
            "confidence": 0.85,
            "evidence": [
                "Leads with logical analysis",
                "Comfortable engaging in direct disagreement"
            ]
        }},
        "J_P": {{
            "preference": "J",
            "confidence": 0.68,
            "evidence": [
                "Structures arguments with clear conclusions",
                "Drives debates toward resolution"
            ]
        }}
    }},
    "type_description": "The Architect - Strategic thinkers who see patterns and build systems. In debate, they construct careful logical frameworks and anticipate counterarguments.",
    "debate_implications": [
        "Likely to prepare structured arguments in advance",
        "May struggle with purely emotional appeals",
        "Excels at long-term strategic positioning"
    ],
    "caveat": "MBTI inference from debate behavior is speculative. Debate style may differ from overall personality."
}}"""


@dataclass
class ArchetypeResult:
    """Result of archetype classification"""
    primary: Archetype
    secondary: List[Archetype] = field(default_factory=list)
    archetype_blend: str = ""
    style_description: str = ""
    signature_moves: List[str] = field(default_factory=list)
    potential_blindspots: List[str] = field(default_factory=list)


@dataclass
class MBTIResult:
    """Result of MBTI inference"""
    mbti_type: str
    confidence: float
    dimension_analysis: Dict[str, Dict]
    type_description: str
    debate_implications: List[str]
    caveat: str = ""


class ArchetypeAnalyzer:
    """
    Classifies debate archetypes and infers MBTI using Claude.
    """

    def __init__(self, claude_client: ClaudeClient):
        self.client = claude_client

    def _format_debate_summaries(
        self,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
        max_debates: int = 15,
    ) -> str:
        """Format debate summaries for prompt"""
        lines = []

        for debate in debates[:max_debates]:
            quality = quality_results.get(debate.thread_id)

            lines.append(f"\n### Debate in r/{debate.subreddit}")
            lines.append(f"Topic: {debate.metadata.topic if debate.metadata else 'Unknown'}")
            lines.append(f"Position: {debate.metadata.user_position if debate.metadata else 'Unknown'}")

            if quality:
                lines.append(f"Quality Scores:")
                lines.append(f"  - Structure: {quality.structure_score}")
                lines.append(f"  - Evidence: {quality.evidence_score}")
                lines.append(f"  - Counterargument: {quality.counterargument_score}")
                lines.append(f"  - Persuasiveness: {quality.persuasiveness_score}")
                lines.append(f"  - Civility: {quality.civility_score}")

                if quality.is_top_argument_candidate:
                    lines.append(f"  ⭐ Top Argument Candidate")

            # Sample user comment
            if debate.user_comments:
                sample = debate.user_comments[0].body[:300]
                if len(debate.user_comments[0].body) > 300:
                    sample += "..."
                lines.append(f"Sample argument: \"{sample}\"")

            lines.append("")

        return "\n".join(lines)

    def _format_behavior_patterns(
        self,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> str:
        """Format behavior patterns for MBTI analysis"""
        lines = []

        # Engagement patterns
        total_comments = sum(d.user_comment_count for d in debates)
        avg_comments_per_thread = total_comments / len(debates) if debates else 0

        lines.append("## Engagement Patterns")
        lines.append(f"- Total debates: {len(debates)}")
        lines.append(f"- Average comments per debate: {avg_comments_per_thread:.1f}")
        lines.append(f"- Topics engaged: {len(set(d.subreddit for d in debates))} subreddits")

        # Content patterns
        lines.append("\n## Argumentation Patterns")

        if quality_results:
            scores = list(quality_results.values())
            lines.append(f"- Average evidence usage: {sum(q.evidence_score for q in scores)/len(scores):.0f}")
            lines.append(f"- Average structure: {sum(q.structure_score for q in scores)/len(scores):.0f}")
            lines.append(f"- Average persuasiveness: {sum(q.persuasiveness_score for q in scores)/len(scores):.0f}")

            # Check for patterns
            high_evidence = sum(1 for q in scores if q.evidence_score >= 70)
            high_civility = sum(1 for q in scores if q.civility_score >= 80)

            lines.append(f"- High-evidence debates: {high_evidence}/{len(scores)}")
            lines.append(f"- High-civility debates: {high_civility}/{len(scores)}")

        # Sample quotes for style analysis
        lines.append("\n## Sample Statements")
        for debate in debates[:5]:
            if debate.user_comments:
                sample = debate.user_comments[0].body[:200]
                lines.append(f"- \"{sample}...\"")

        return "\n".join(lines)

    def classify_archetype(
        self,
        username: str,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> ArchetypeResult:
        """
        Classify user's debate archetype.

        Args:
            username: Reddit username
            debates: List of debate threads
            quality_results: Quality analysis results

        Returns:
            ArchetypeResult with primary and secondary archetypes
        """
        logger.info(f"Classifying archetype for u/{username}")

        # Calculate averages
        if quality_results:
            scores = list(quality_results.values())
            avg_structure = sum(q.structure_score for q in scores) / len(scores)
            avg_evidence = sum(q.evidence_score for q in scores) / len(scores)
            avg_counter = sum(q.counterargument_score for q in scores) / len(scores)
            avg_persuade = sum(q.persuasiveness_score for q in scores) / len(scores)
            avg_civility = sum(q.civility_score for q in scores) / len(scores)
        else:
            avg_structure = avg_evidence = avg_counter = avg_persuade = avg_civility = 50

        debate_summaries = self._format_debate_summaries(debates, quality_results)

        prompt = ARCHETYPE_PROMPT.format(
            username=username,
            debate_summaries=debate_summaries,
            avg_structure=f"{avg_structure:.0f}",
            avg_evidence=f"{avg_evidence:.0f}",
            avg_counterargument=f"{avg_counter:.0f}",
            avg_persuasiveness=f"{avg_persuade:.0f}",
            avg_civility=f"{avg_civility:.0f}",
            total_debates=len(debates),
        )

        response = self.client.analyze(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )

        return self._parse_archetype_response(response)

    def _parse_archetype_response(self, response: Dict) -> ArchetypeResult:
        """Parse archetype classification response"""

        # Parse primary archetype
        primary_data = response.get("primary_archetype", {})
        try:
            primary_type = ArchetypeType(primary_data.get("type", "generalist"))
        except ValueError:
            primary_type = ArchetypeType.GENERALIST

        primary = Archetype(
            archetype_type=primary_type,
            confidence=primary_data.get("confidence", 0.5),
            evidence=primary_data.get("evidence", []),
        )

        # Parse secondary archetypes
        secondary = []
        for sec_data in response.get("secondary_archetypes", []):
            try:
                sec_type = ArchetypeType(sec_data.get("type", "generalist"))
            except ValueError:
                continue

            secondary.append(Archetype(
                archetype_type=sec_type,
                confidence=sec_data.get("confidence", 0.5),
                evidence=sec_data.get("evidence", []),
            ))

        return ArchetypeResult(
            primary=primary,
            secondary=secondary,
            archetype_blend=response.get("archetype_blend", ""),
            style_description=response.get("style_description", ""),
            signature_moves=response.get("signature_moves", []),
            potential_blindspots=response.get("potential_blindspots", []),
        )

    def infer_mbti(
        self,
        username: str,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> MBTIResult:
        """
        Infer MBTI type from debate patterns.

        Args:
            username: Reddit username
            debates: List of debate threads
            quality_results: Quality analysis results

        Returns:
            MBTIResult with type and dimension analysis
        """
        logger.info(f"Inferring MBTI for u/{username}")

        behavior_patterns = self._format_behavior_patterns(debates, quality_results)

        prompt = MBTI_PROMPT.format(
            username=username,
            behavior_patterns=behavior_patterns,
        )

        response = self.client.analyze(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )

        return self._parse_mbti_response(response)

    def _parse_mbti_response(self, response: Dict) -> MBTIResult:
        """Parse MBTI inference response"""

        return MBTIResult(
            mbti_type=response.get("mbti_type", "XXXX"),
            confidence=response.get("confidence", 0.5),
            dimension_analysis=response.get("dimension_analysis", {}),
            type_description=response.get("type_description", ""),
            debate_implications=response.get("debate_implications", []),
            caveat=response.get("caveat", "MBTI inference from debate behavior is speculative."),
        )

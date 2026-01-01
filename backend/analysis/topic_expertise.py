"""
Topic expertise analysis using Claude

Analyzes debate history to determine:
- Topic areas where user demonstrates expertise
- Expertise levels by domain
- Knowledge depth vs breadth
- Cross-domain connections
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from collections import defaultdict

from .claude_client import ClaudeClient
from ..models.user_profile import (
    DebateThread,
    ArgumentQuality,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert at assessing domain knowledge and expertise from argumentation.

You analyze debate patterns to identify:
- Areas of genuine expertise vs superficial familiarity
- Depth of knowledge demonstrated through argumentation
- Consistency of quality across topics
- Credibility signals in specific domains

You distinguish between:
- Deep expertise (technical knowledge, nuanced understanding)
- Working knowledge (can discuss competently)
- Casual familiarity (basic awareness only)

Always respond with valid JSON matching the requested schema."""


TOPIC_EXPERTISE_PROMPT = """Analyze this user's topic expertise based on their debate history.

## User: u/{username}

## Debates by Topic Category

{debates_by_topic}

## Quality Summary by Topic

{quality_by_topic}

## Expertise Assessment Required

Evaluate the user's expertise across topics based on:

1. **Debate Quality**: Higher scores in a topic suggest more competence
2. **Evidence Usage**: Citation quality and appropriateness
3. **Nuance**: Ability to handle complexity and edge cases
4. **Consistency**: Performance across multiple debates in same topic
5. **Terminology**: Appropriate use of domain-specific language

### Expertise Levels

- **Expert** (90-100): Deep technical knowledge, can discuss nuances, cites appropriately
- **Advanced** (75-89): Strong working knowledge, handles most complexity
- **Intermediate** (50-74): Solid basics, occasional gaps in advanced topics
- **Beginner** (25-49): Basic familiarity, struggles with complexity
- **Novice** (0-24): Minimal knowledge, frequent errors

## Required JSON Output

{{
    "username": "{username}",
    "expertise_map": [
        {{
            "topic": "Economics",
            "level": "advanced",
            "score": 82,
            "debate_count": 8,
            "avg_quality": 78,
            "evidence": [
                "Correctly applies marginal utility concepts",
                "Cites academic economic research appropriately",
                "Distinguishes between macro and microeconomic effects"
            ],
            "notable_debates": [
                {{
                    "debate_id": "abc123",
                    "title": "Minimum wage effects",
                    "quality_score": 85
                }}
            ],
            "growth_potential": "Could strengthen empirical methodology"
        }},
        {{
            "topic": "Technology",
            "level": "expert",
            "score": 91,
            "debate_count": 12,
            "avg_quality": 86,
            "evidence": [
                "Demonstrates deep understanding of system architecture",
                "Uses technical terminology precisely",
                "Can explain complex concepts clearly"
            ],
            "notable_debates": [],
            "growth_potential": "Already at expert level"
        }},
        {{
            "topic": "Philosophy",
            "level": "intermediate",
            "score": 58,
            "debate_count": 3,
            "avg_quality": 62,
            "evidence": [
                "Familiar with major philosophical positions",
                "Sometimes conflates related but distinct concepts"
            ],
            "notable_debates": [],
            "growth_potential": "Could benefit from studying primary sources"
        }}
    ],
    "knowledge_profile": {{
        "breadth": "moderate",
        "depth": "variable",
        "primary_domains": ["Technology", "Economics"],
        "emerging_interests": ["Philosophy"],
        "cross_domain_connections": [
            "Applies economic reasoning to technology policy debates",
            "Connects philosophical ethics to practical technology decisions"
        ]
    }},
    "credibility_assessment": {{
        "strongest_areas": ["Technology", "Economics"],
        "weakest_areas": ["Philosophy"],
        "overall_credibility": "high",
        "notes": "Strong technical background with solid analytical skills. Most credible in STEM and quantitative topics."
    }},
    "recommendations": [
        "Continue developing philosophical foundations",
        "Consider engaging more with empirical social science",
        "Leverage cross-domain expertise in technology policy"
    ]
}}

Breadth levels: narrow (1-2 topics), moderate (3-5 topics), broad (6+ topics)
Depth levels: shallow (mostly beginner/novice), variable (mixed), deep (mostly advanced/expert)"""


@dataclass
class TopicExpertise:
    """Expertise assessment for a single topic"""
    topic: str
    level: str
    score: int
    debate_count: int
    avg_quality: float
    evidence: List[str] = field(default_factory=list)
    notable_debates: List[Dict] = field(default_factory=list)
    growth_potential: str = ""


@dataclass
class KnowledgeProfile:
    """Overall knowledge profile"""
    breadth: str
    depth: str
    primary_domains: List[str]
    emerging_interests: List[str]
    cross_domain_connections: List[str]


@dataclass
class TopicExpertiseResult:
    """Complete topic expertise analysis result"""
    expertise_map: List[TopicExpertise]
    knowledge_profile: KnowledgeProfile
    credibility_assessment: Dict[str, Any]
    recommendations: List[str]


class TopicExpertiseAnalyzer:
    """
    Analyzes debate history for topic expertise patterns.
    """

    def __init__(self, claude_client: ClaudeClient):
        self.client = claude_client

    def _group_debates_by_topic(
        self,
        debates: List[DebateThread],
    ) -> Dict[str, List[DebateThread]]:
        """Group debates by topic category"""
        by_topic: Dict[str, List[DebateThread]] = defaultdict(list)

        for debate in debates:
            category = "other"
            if debate.metadata and debate.metadata.topic_category:
                category = debate.metadata.topic_category

            by_topic[category].append(debate)

        return dict(by_topic)

    def _format_debates_by_topic(
        self,
        debates_by_topic: Dict[str, List[DebateThread]],
        quality_results: Dict[str, ArgumentQuality],
    ) -> str:
        """Format debates grouped by topic"""
        lines = []

        for topic, debates in sorted(debates_by_topic.items(), key=lambda x: len(x[1]), reverse=True):
            lines.append(f"\n## {topic.title()} ({len(debates)} debates)")

            for debate in debates[:5]:
                quality = quality_results.get(debate.thread_id)

                lines.append(f"\n### {debate.thread_title[:80]}")
                lines.append(f"Subreddit: r/{debate.subreddit}")

                if debate.metadata:
                    lines.append(f"Topic: {debate.metadata.topic}")
                    lines.append(f"Position: {debate.metadata.user_position}")

                if quality:
                    lines.append(f"Quality: {quality.overall_score}")
                    lines.append(f"Evidence Score: {quality.evidence_score}")

                # Sample argument
                if debate.user_comments:
                    sample = debate.user_comments[0].body[:300]
                    lines.append(f"Sample: \"{sample}...\"")

        return "\n".join(lines)

    def _format_quality_by_topic(
        self,
        debates_by_topic: Dict[str, List[DebateThread]],
        quality_results: Dict[str, ArgumentQuality],
    ) -> str:
        """Format quality statistics by topic"""
        lines = []

        for topic, debates in sorted(debates_by_topic.items()):
            qualities = [
                quality_results[d.thread_id]
                for d in debates
                if d.thread_id in quality_results
            ]

            if not qualities:
                continue

            avg_overall = sum(q.overall_score for q in qualities) / len(qualities)
            avg_evidence = sum(q.evidence_score for q in qualities) / len(qualities)
            avg_structure = sum(q.structure_score for q in qualities) / len(qualities)

            lines.append(f"\n{topic.title()}:")
            lines.append(f"  Debates: {len(qualities)}")
            lines.append(f"  Avg Overall: {avg_overall:.0f}")
            lines.append(f"  Avg Evidence: {avg_evidence:.0f}")
            lines.append(f"  Avg Structure: {avg_structure:.0f}")

        return "\n".join(lines)

    def analyze_expertise(
        self,
        username: str,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> TopicExpertiseResult:
        """
        Analyze user's topic expertise across debates.

        Args:
            username: Reddit username
            debates: List of debate threads
            quality_results: Quality analysis results

        Returns:
            TopicExpertiseResult with expertise map and profile
        """
        logger.info(f"Analyzing topic expertise for u/{username}")

        debates_by_topic = self._group_debates_by_topic(debates)
        debates_formatted = self._format_debates_by_topic(debates_by_topic, quality_results)
        quality_formatted = self._format_quality_by_topic(debates_by_topic, quality_results)

        prompt = TOPIC_EXPERTISE_PROMPT.format(
            username=username,
            debates_by_topic=debates_formatted,
            quality_by_topic=quality_formatted,
        )

        response = self.client.analyze(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )

        return self._parse_response(response)

    def _parse_response(self, response: Dict) -> TopicExpertiseResult:
        """Parse topic expertise response"""

        # Parse expertise map
        expertise_map = []
        for exp_data in response.get("expertise_map", []):
            expertise_map.append(TopicExpertise(
                topic=exp_data.get("topic", "Unknown"),
                level=exp_data.get("level", "intermediate"),
                score=exp_data.get("score", 50),
                debate_count=exp_data.get("debate_count", 0),
                avg_quality=exp_data.get("avg_quality", 50),
                evidence=exp_data.get("evidence", []),
                notable_debates=exp_data.get("notable_debates", []),
                growth_potential=exp_data.get("growth_potential", ""),
            ))

        # Parse knowledge profile
        kp_data = response.get("knowledge_profile", {})
        knowledge_profile = KnowledgeProfile(
            breadth=kp_data.get("breadth", "moderate"),
            depth=kp_data.get("depth", "variable"),
            primary_domains=kp_data.get("primary_domains", []),
            emerging_interests=kp_data.get("emerging_interests", []),
            cross_domain_connections=kp_data.get("cross_domain_connections", []),
        )

        return TopicExpertiseResult(
            expertise_map=expertise_map,
            knowledge_profile=knowledge_profile,
            credibility_assessment=response.get("credibility_assessment", {}),
            recommendations=response.get("recommendations", []),
        )

    def get_expertise_summary(
        self,
        result: TopicExpertiseResult,
    ) -> Dict[str, Any]:
        """Generate a summary of expertise for display"""

        # Sort by score
        sorted_expertise = sorted(
            result.expertise_map,
            key=lambda x: x.score,
            reverse=True,
        )

        return {
            "top_domains": [
                {
                    "topic": exp.topic,
                    "level": exp.level,
                    "score": exp.score,
                }
                for exp in sorted_expertise[:5]
            ],
            "breadth": result.knowledge_profile.breadth,
            "depth": result.knowledge_profile.depth,
            "strongest_area": sorted_expertise[0].topic if sorted_expertise else None,
            "total_topics": len(result.expertise_map),
            "expert_level_count": sum(1 for e in result.expertise_map if e.level == "expert"),
            "advanced_level_count": sum(1 for e in result.expertise_map if e.level == "advanced"),
        }

"""
Profile Synthesizer

Combines all analysis results into a comprehensive user profile:
- Argument quality
- Fallacy patterns
- Debate archetype
- MBTI inference
- Top arguments
- Topic expertise
- Good faith assessment
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from ..models.user_profile import (
    UserProfile,
    DebateThread,
    ArgumentQuality,
    GoodFaithAssessment,
)
from .fallacy_analyzer import FallacyProfile, FallacyAnalyzer
from .archetype_analyzer import ArchetypeResult, MBTIResult, ArchetypeAnalyzer
from .top_arguments import TopArgumentsResult, TopArgumentsAnalyzer
from .topic_expertise import TopicExpertiseResult, TopicExpertiseAnalyzer
from .claude_client import ClaudeClient

logger = logging.getLogger(__name__)


GOOD_FAITH_PROMPT = """Assess whether this debater argues in good faith based on their debate history.

## User: u/{username}

## Debate Statistics
- Total debates analyzed: {total_debates}
- Average civility score: {avg_civility}
- Changed opponent's mind: {mind_changes} times
- Conceded to opponent: {concessions} times
- Fallacy density: {fallacy_density}

## Behavioral Patterns
{behavioral_patterns}

## Good Faith Indicators

**Positive Signals:**
- Acknowledges valid opponent points
- Updates position based on new evidence
- Steelmans opponent arguments
- Maintains civility under pressure
- Admits uncertainty or mistakes

**Negative Signals:**
- Frequent strawmanning
- Moving goalposts
- Personal attacks
- Sealioning or bad-faith questioning
- Never concedes any points

## Required JSON Output

{{
    "username": "{username}",
    "good_faith_score": 78,
    "assessment": "generally_good_faith",
    "positive_indicators": [
        "High civility scores across debates",
        "Occasionally concedes valid points",
        "Avoids personal attacks"
    ],
    "negative_indicators": [
        "Sometimes misrepresents opponent positions",
        "Rarely updates stated positions"
    ],
    "intellectual_honesty": {{
        "score": 75,
        "evidence": [
            "Cites sources regularly",
            "Acknowledges limitations of own arguments"
        ]
    }},
    "openness_to_change": {{
        "score": 65,
        "evidence": [
            "Has changed mind in 2 debates",
            "Generally resistant to updating views"
        ]
    }},
    "respect_for_opponents": {{
        "score": 82,
        "evidence": [
            "Maintains professional tone",
            "Addresses arguments rather than persons"
        ]
    }},
    "summary": "This debater generally argues in good faith with occasional rhetorical overreach. Shows respect for opponents and uses evidence appropriately, though could be more open to updating positions."
}}

Assessment levels: exemplary, generally_good_faith, mixed, questionable, bad_faith"""


@dataclass
class SynthesizedProfile:
    """Complete synthesized user profile"""
    username: str
    analyzed_at: str

    # Core scores
    overall_score: int
    debates_analyzed: int
    total_comments: int

    # Quality breakdown
    quality_breakdown: Dict[str, float]

    # Archetype and personality
    archetype: Dict[str, Any]
    mbti: Dict[str, Any]

    # Good faith
    good_faith: Dict[str, Any]

    # Fallacy profile
    fallacy_profile: Dict[str, Any]

    # Top arguments
    top_arguments: List[Dict[str, Any]]
    signature_techniques: List[Dict[str, Any]]

    # Topic expertise
    topic_expertise: List[Dict[str, Any]]
    knowledge_profile: Dict[str, Any]

    # Debate list
    debates: List[Dict[str, Any]]


class ProfileSynthesizer:
    """
    Synthesizes all analysis results into a comprehensive profile.
    """

    def __init__(self, claude_client: ClaudeClient):
        self.client = claude_client
        self.fallacy_analyzer = FallacyAnalyzer(claude_client)
        self.archetype_analyzer = ArchetypeAnalyzer(claude_client)
        self.top_args_analyzer = TopArgumentsAnalyzer(claude_client)
        self.topic_analyzer = TopicExpertiseAnalyzer(claude_client)

    def synthesize(
        self,
        username: str,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
        run_all_analyses: bool = True,
    ) -> SynthesizedProfile:
        """
        Run all analyses and synthesize into comprehensive profile.

        Args:
            username: Reddit username
            debates: List of debate threads
            quality_results: Argument quality results
            run_all_analyses: Whether to run all Claude analyses

        Returns:
            SynthesizedProfile with all analysis results
        """
        logger.info(f"Synthesizing profile for u/{username}")

        # Calculate base statistics
        scores = list(quality_results.values())
        overall_score = int(sum(q.overall_score for q in scores) / len(scores)) if scores else 0

        quality_breakdown = self._calculate_quality_breakdown(scores)

        # Initialize results
        fallacy_profile = {}
        archetype = {}
        mbti = {}
        top_arguments = []
        signature_techniques = []
        topic_expertise = []
        knowledge_profile = {}
        good_faith = {}

        if run_all_analyses and debates:
            # Run fallacy analysis
            logger.info("Running fallacy analysis...")
            fallacy_results = self.fallacy_analyzer.analyze_debates_batch(debates)
            fallacy_profile_obj = self.fallacy_analyzer.build_fallacy_profile(fallacy_results)
            fallacy_profile = self._serialize_fallacy_profile(fallacy_profile_obj)

            # Run archetype classification
            logger.info("Running archetype classification...")
            archetype_result = self.archetype_analyzer.classify_archetype(
                username, debates, quality_results
            )
            archetype = self._serialize_archetype(archetype_result)

            # Run MBTI inference
            logger.info("Running MBTI inference...")
            mbti_result = self.archetype_analyzer.infer_mbti(
                username, debates, quality_results
            )
            mbti = self._serialize_mbti(mbti_result)

            # Run top arguments extraction
            logger.info("Extracting top arguments...")
            top_args_result = self.top_args_analyzer.extract_top_arguments(
                username, debates, quality_results
            )
            top_arguments = self._serialize_top_arguments(top_args_result)
            signature_techniques = top_args_result.signature_techniques

            # Run topic expertise analysis
            logger.info("Analyzing topic expertise...")
            topic_result = self.topic_analyzer.analyze_expertise(
                username, debates, quality_results
            )
            topic_expertise = self._serialize_topic_expertise(topic_result)
            knowledge_profile = {
                "breadth": topic_result.knowledge_profile.breadth,
                "depth": topic_result.knowledge_profile.depth,
                "primary_domains": topic_result.knowledge_profile.primary_domains,
                "emerging_interests": topic_result.knowledge_profile.emerging_interests,
                "cross_domain_connections": topic_result.knowledge_profile.cross_domain_connections,
            }

            # Run good faith assessment
            logger.info("Assessing good faith...")
            good_faith = self._assess_good_faith(
                username, debates, quality_results, fallacy_profile_obj
            )

        # Build debate summaries
        debate_summaries = self._build_debate_summaries(debates, quality_results)

        return SynthesizedProfile(
            username=username,
            analyzed_at=datetime.now().isoformat(),
            overall_score=overall_score,
            debates_analyzed=len(debates),
            total_comments=sum(d.user_comment_count for d in debates),
            quality_breakdown=quality_breakdown,
            archetype=archetype,
            mbti=mbti,
            good_faith=good_faith,
            fallacy_profile=fallacy_profile,
            top_arguments=top_arguments,
            signature_techniques=signature_techniques,
            topic_expertise=topic_expertise,
            knowledge_profile=knowledge_profile,
            debates=debate_summaries,
        )

    def _calculate_quality_breakdown(
        self,
        scores: List[ArgumentQuality],
    ) -> Dict[str, float]:
        """Calculate average quality across dimensions"""
        if not scores:
            return {
                "structure": 0,
                "evidence": 0,
                "counterargument": 0,
                "persuasiveness": 0,
                "civility": 0,
            }

        n = len(scores)
        return {
            "structure": round(sum(q.structure_score for q in scores) / n, 1),
            "evidence": round(sum(q.evidence_score for q in scores) / n, 1),
            "counterargument": round(sum(q.counterargument_score for q in scores) / n, 1),
            "persuasiveness": round(sum(q.persuasiveness_score for q in scores) / n, 1),
            "civility": round(sum(q.civility_score for q in scores) / n, 1),
        }

    def _serialize_fallacy_profile(self, profile: FallacyProfile) -> Dict[str, Any]:
        """Convert FallacyProfile to serializable dict"""
        return {
            "total_fallacies": profile.total_fallacies,
            "fallacy_counts": profile.fallacy_counts,
            "fallacy_by_severity": profile.fallacy_by_severity,
            "ranked_fallacies": profile.ranked_fallacies,
            "avg_density": profile.avg_density,
            "trend": profile.trend,
            "notes": profile.notes,
        }

    def _serialize_archetype(self, result: ArchetypeResult) -> Dict[str, Any]:
        """Convert ArchetypeResult to serializable dict"""
        return {
            "primary": {
                "type": result.primary.archetype_type.value,
                "confidence": result.primary.confidence,
                "evidence": result.primary.evidence,
            },
            "secondary": [
                {
                    "type": sec.archetype_type.value,
                    "confidence": sec.confidence,
                    "evidence": sec.evidence,
                }
                for sec in result.secondary
            ],
            "archetype_blend": result.archetype_blend,
            "style_description": result.style_description,
            "signature_moves": result.signature_moves,
            "potential_blindspots": result.potential_blindspots,
        }

    def _serialize_mbti(self, result: MBTIResult) -> Dict[str, Any]:
        """Convert MBTIResult to serializable dict"""
        return {
            "type": result.mbti_type,
            "confidence": result.confidence,
            "dimension_analysis": result.dimension_analysis,
            "type_description": result.type_description,
            "debate_implications": result.debate_implications,
            "caveat": result.caveat,
        }

    def _serialize_top_arguments(self, result: TopArgumentsResult) -> List[Dict[str, Any]]:
        """Convert TopArgumentsResult to serializable list"""
        return [
            {
                "rank": arg.rank,
                "debate_id": arg.debate_id,
                "category": arg.category.value,
                "title": arg.title,
                "snippet": arg.snippet,
                "subreddit": arg.subreddit,
                "thread_title": arg.thread_title,
                "opponent_position": arg.opponent_position,
                "outcome": arg.outcome,
                "quality_breakdown": {
                    "structure": arg.structure_score,
                    "evidence": arg.evidence_score,
                    "persuasiveness": arg.persuasiveness_score,
                    "civility": arg.civility_score,
                },
                "why_exceptional": arg.why_exceptional,
                "techniques_used": arg.techniques_used,
            }
            for arg in result.top_arguments
        ]

    def _serialize_topic_expertise(self, result: TopicExpertiseResult) -> List[Dict[str, Any]]:
        """Convert TopicExpertiseResult to serializable list"""
        return [
            {
                "topic": exp.topic,
                "level": exp.level,
                "score": exp.score,
                "debate_count": exp.debate_count,
                "avg_quality": exp.avg_quality,
                "evidence": exp.evidence,
                "notable_debates": exp.notable_debates,
                "growth_potential": exp.growth_potential,
            }
            for exp in result.expertise_map
        ]

    def _assess_good_faith(
        self,
        username: str,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
        fallacy_profile: FallacyProfile,
    ) -> Dict[str, Any]:
        """Assess good faith using Claude"""

        scores = list(quality_results.values())

        # Calculate statistics
        avg_civility = sum(q.civility_score for q in scores) / len(scores) if scores else 50
        mind_changes = sum(1 for q in scores if q.changed_opponent_mind)
        concessions = sum(
            1 for d in debates
            if d.metadata and d.metadata.apparent_outcome == "opponent_won"
        )

        # Build behavioral patterns
        patterns = []
        if avg_civility >= 80:
            patterns.append("Consistently maintains high civility")
        elif avg_civility < 60:
            patterns.append("Civility issues in some debates")

        if mind_changes > 0:
            patterns.append(f"Changed opponent's mind {mind_changes} times")

        if fallacy_profile.avg_density in ["high", "very_high"]:
            patterns.append("High frequency of logical fallacies")
        elif fallacy_profile.avg_density == "low":
            patterns.append("Low fallacy rate indicates careful reasoning")

        strawman_count = fallacy_profile.fallacy_counts.get("strawman", 0)
        if strawman_count >= 3:
            patterns.append(f"Strawman fallacy detected {strawman_count} times")

        prompt = GOOD_FAITH_PROMPT.format(
            username=username,
            total_debates=len(debates),
            avg_civility=f"{avg_civility:.0f}",
            mind_changes=mind_changes,
            concessions=concessions,
            fallacy_density=fallacy_profile.avg_density,
            behavioral_patterns="\n".join(f"- {p}" for p in patterns),
        )

        response = self.client.analyze(
            system_prompt="You assess good faith in online debates based on behavioral patterns.",
            user_prompt=prompt,
        )

        return response

    def _build_debate_summaries(
        self,
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> List[Dict[str, Any]]:
        """Build debate summary list"""
        summaries = []

        for debate in debates:
            quality = quality_results.get(debate.thread_id)

            summary = {
                "thread_id": debate.thread_id,
                "thread_title": debate.thread_title[:100],
                "subreddit": debate.subreddit,
                "user_comment_count": debate.user_comment_count,
                "user_is_op": debate.user_is_op,
            }

            if debate.metadata:
                summary["topic"] = debate.metadata.topic
                summary["topic_category"] = debate.metadata.topic_category
                summary["user_position"] = debate.metadata.user_position
                summary["opponent_position"] = debate.metadata.opponent_position
                summary["outcome"] = debate.metadata.apparent_outcome

            if quality:
                summary["quality"] = {
                    "overall": quality.overall_score,
                    "structure": quality.structure_score,
                    "evidence": quality.evidence_score,
                    "counterargument": quality.counterargument_score,
                    "persuasiveness": quality.persuasiveness_score,
                    "civility": quality.civility_score,
                }
                summary["is_top_argument"] = quality.is_top_argument_candidate
                summary["changed_mind"] = quality.changed_opponent_mind

            summaries.append(summary)

        return summaries

    def to_dict(self, profile: SynthesizedProfile) -> Dict[str, Any]:
        """Convert SynthesizedProfile to dict for caching"""
        return asdict(profile)

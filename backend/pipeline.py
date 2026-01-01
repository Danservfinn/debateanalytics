"""
Main orchestration pipeline for user debate analysis

Coordinates the full analysis flow:
1. Fetch Reddit data
2. Identify debates
3. Analyze argument quality
4. Run comprehensive analysis (fallacies, archetype, MBTI, expertise)
5. Build user profile
6. Cache results
"""

import logging
import argparse
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict
from datetime import datetime

from config import Config
from cache.cache_manager import CacheManager
from data.reddit_fetcher import RedditFetcher
from analysis.claude_client import ClaudeClient
from analysis.debate_identifier import DebateIdentifier
from analysis.argument_analyzer import ArgumentAnalyzer
from analysis.profile_synthesizer import ProfileSynthesizer, SynthesizedProfile
from models.user_profile import (
    UserProfile,
    DebateThread,
    ArgumentQuality,
    Archetype,
    ArchetypeType,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@dataclass
class PipelineProgress:
    """Track pipeline progress"""
    stage: str = "initializing"
    percent: int = 0
    message: str = ""
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


@dataclass
class PipelineResult:
    """Result of pipeline execution"""
    success: bool
    username: str
    profile: Optional[UserProfile] = None
    debates_found: int = 0
    debates_analyzed: int = 0
    execution_time_seconds: float = 0
    error: Optional[str] = None


class AnalysisPipeline:
    """
    Orchestrates the full user analysis pipeline.

    Coordinates data fetching, debate identification, quality analysis,
    and profile generation with caching at each stage.
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        progress_callback: Optional[callable] = None,
    ):
        self.config = config or Config()
        self.progress_callback = progress_callback
        self.progress = PipelineProgress()

        # Initialize components
        self.cache = CacheManager(
            cache_dir=Path(self.config.cache_dir),
            ttl_hours=self.config.cache_ttl_hours,
        )
        self.reddit = RedditFetcher()
        self.claude = ClaudeClient(
            api_key=self.config.anthropic_api_key,
            model=self.config.claude_model,
        )
        self.debate_identifier = DebateIdentifier(self.claude)
        self.argument_analyzer = ArgumentAnalyzer(self.claude)
        self.profile_synthesizer = ProfileSynthesizer(self.claude)

    def _update_progress(self, stage: str, percent: int, message: str = ""):
        """Update and report progress"""
        self.progress.stage = stage
        self.progress.percent = percent
        self.progress.message = message

        logger.info(f"[{percent}%] {stage}: {message}")

        if self.progress_callback:
            self.progress_callback(self.progress)

    def analyze_user(
        self,
        username: str,
        max_comments: int = 500,
        max_threads: int = 100,
        force_refresh: bool = False,
    ) -> PipelineResult:
        """
        Run full analysis pipeline for a user.

        Args:
            username: Reddit username to analyze
            max_comments: Maximum comments to fetch
            max_threads: Maximum threads to analyze
            force_refresh: Ignore cached data

        Returns:
            PipelineResult with profile and stats
        """
        start_time = datetime.now()
        self.progress = PipelineProgress(started_at=start_time)

        try:
            # Check cache first
            if not force_refresh:
                cached = self.cache.get_user_cache(username)
                if cached:
                    self._update_progress("cache_hit", 100, "Using cached profile")
                    return PipelineResult(
                        success=True,
                        username=username,
                        debates_found=cached.get("debates_analyzed", 0),
                        debates_analyzed=cached.get("debates_analyzed", 0),
                        execution_time_seconds=0,
                    )

            # Stage 1: Fetch Reddit data
            self._update_progress("fetching", 10, f"Fetching Reddit data for u/{username}")

            user_data = self.reddit.fetch_user_data(
                username=username,
                max_comments=max_comments,
            )

            if not user_data.get("comments"):
                return PipelineResult(
                    success=False,
                    username=username,
                    error="No comments found for user",
                )

            comments = user_data["comments"]
            self._update_progress("fetching", 20, f"Fetched {len(comments)} comments")

            # Stage 2: Build debate threads
            self._update_progress("threading", 30, "Building debate threads")

            threads = self.reddit.build_debate_threads(
                username=username,
                comments=comments,
                max_threads=max_threads,
            )

            self._update_progress("threading", 40, f"Built {len(threads)} threads")

            # Stage 3: Quick filter
            self._update_progress("filtering", 45, "Pre-filtering potential debates")

            potential_debates = self.debate_identifier.quick_filter(threads)
            self._update_progress("filtering", 50, f"{len(potential_debates)} potential debates")

            # Stage 4: Claude debate identification
            self._update_progress("identifying", 55, "Identifying debates with Claude")

            identified = self.debate_identifier.identify_debates(
                username=username,
                threads=potential_debates,
            )

            debates = [t for t in identified if t.is_debate]
            self._update_progress("identifying", 65, f"Identified {len(debates)} debates")

            if not debates:
                # No debates found - still cache this result
                profile_data = self._build_empty_profile(username, user_data)
                self.cache.set_user_cache(username, profile_data)

                return PipelineResult(
                    success=True,
                    username=username,
                    debates_found=0,
                    debates_analyzed=0,
                    execution_time_seconds=(datetime.now() - start_time).total_seconds(),
                )

            # Stage 5: Analyze argument quality
            self._update_progress("analyzing", 55, f"Analyzing {len(debates)} debates")

            quality_results = self.argument_analyzer.analyze_debates_batch(debates)
            self._update_progress("analyzing", 65, f"Analyzed {len(quality_results)} debates")

            # Stage 6: Run comprehensive analysis (fallacies, archetype, MBTI, expertise, top args)
            self._update_progress("synthesizing", 70, "Running comprehensive analysis...")

            synthesized_profile = self.profile_synthesizer.synthesize(
                username=username,
                debates=debates,
                quality_results=quality_results,
                run_all_analyses=True,
            )
            self._update_progress("synthesizing", 90, "Profile synthesized")

            # Stage 7: Cache results
            self._update_progress("caching", 95, "Caching results")

            profile_data = asdict(synthesized_profile)
            profile_data["total_threads"] = len(threads)
            self.cache.set_user_cache(username, profile_data)

            # Complete
            self.progress.completed_at = datetime.now()
            self._update_progress("complete", 100, "Analysis complete")

            execution_time = (datetime.now() - start_time).total_seconds()

            return PipelineResult(
                success=True,
                username=username,
                debates_found=len(debates),
                debates_analyzed=len(quality_results),
                execution_time_seconds=execution_time,
            )

        except Exception as e:
            logger.error(f"Pipeline failed for u/{username}: {e}")
            self.progress.error = str(e)

            return PipelineResult(
                success=False,
                username=username,
                error=str(e),
                execution_time_seconds=(datetime.now() - start_time).total_seconds(),
            )

    def _build_empty_profile(
        self,
        username: str,
        user_data: Dict,
    ) -> Dict[str, Any]:
        """Build profile when no debates found"""
        return {
            "username": username,
            "overall_score": None,
            "debates_analyzed": 0,
            "total_comments": len(user_data.get("comments", [])),
            "total_threads": 0,
            "message": "No debates found in comment history",
            "debates": [],
            "quality_breakdown": None,
        }

    def _build_profile(
        self,
        username: str,
        user_data: Dict,
        threads: List[DebateThread],
        debates: List[DebateThread],
        quality_results: Dict[str, ArgumentQuality],
    ) -> Dict[str, Any]:
        """Build comprehensive user profile"""

        # Calculate aggregate scores
        scores = [q.overall_score for q in quality_results.values()]
        avg_score = sum(scores) / len(scores) if scores else 0

        # Calculate dimension averages
        n = len(quality_results) if quality_results else 1
        quality_breakdown = {
            "structure": sum(q.structure_score for q in quality_results.values()) / n,
            "evidence": sum(q.evidence_score for q in quality_results.values()) / n,
            "counterargument": sum(q.counterargument_score for q in quality_results.values()) / n,
            "persuasiveness": sum(q.persuasiveness_score for q in quality_results.values()) / n,
            "civility": sum(q.civility_score for q in quality_results.values()) / n,
        }

        # Collect topics
        topics = {}
        for debate in debates:
            if debate.metadata and debate.metadata.topic_category:
                cat = debate.metadata.topic_category
                topics[cat] = topics.get(cat, 0) + 1

        top_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:5]

        # Infer archetype from patterns
        archetype = self._infer_archetype(quality_breakdown, quality_results)

        # Build debate summaries
        debate_summaries = []
        for debate in debates:
            quality = quality_results.get(debate.thread_id)
            debate_summaries.append({
                "thread_id": debate.thread_id,
                "thread_title": debate.thread_title[:100],
                "subreddit": debate.subreddit,
                "topic": debate.metadata.topic if debate.metadata else None,
                "topic_category": debate.metadata.topic_category if debate.metadata else None,
                "user_position": debate.metadata.user_position if debate.metadata else None,
                "opponent_position": debate.metadata.opponent_position if debate.metadata else None,
                "outcome": debate.metadata.apparent_outcome if debate.metadata else None,
                "quality_score": quality.overall_score if quality else None,
                "is_top_argument": quality.is_top_argument_candidate if quality else False,
            })

        # Find top arguments
        top_arguments = [
            d for d in debate_summaries
            if d.get("is_top_argument") or (d.get("quality_score") or 0) >= 80
        ][:10]

        return {
            "username": username,
            "overall_score": int(avg_score),
            "archetype": archetype,
            "debates_analyzed": len(debates),
            "total_comments": len(user_data.get("comments", [])),
            "total_threads": len(threads),
            "topic_expertise": top_topics,
            "quality_breakdown": quality_breakdown,
            "debates": debate_summaries,
            "top_arguments": top_arguments,
            "analyzed_at": datetime.now().isoformat(),
        }

    def _infer_archetype(
        self,
        quality_breakdown: Dict[str, float],
        quality_results: Dict[str, ArgumentQuality],
    ) -> Dict[str, Any]:
        """Infer debate archetype from quality patterns"""

        # Simple archetype inference based on dimension scores
        structure = quality_breakdown.get("structure", 50)
        evidence = quality_breakdown.get("evidence", 50)
        counterargument = quality_breakdown.get("counterargument", 50)
        persuasiveness = quality_breakdown.get("persuasiveness", 50)
        civility = quality_breakdown.get("civility", 50)

        archetype_type = ArchetypeType.GENERALIST
        confidence = 0.5

        # Determine dominant archetype
        if evidence >= 75 and structure >= 70:
            archetype_type = ArchetypeType.PROFESSOR
            confidence = min(evidence, structure) / 100
        elif counterargument >= 75 and civility >= 80:
            archetype_type = ArchetypeType.SOCRATIC
            confidence = min(counterargument, civility) / 100
        elif evidence >= 70 and structure >= 75:
            archetype_type = ArchetypeType.ANALYST
            confidence = (evidence + structure) / 200
        elif persuasiveness >= 75:
            archetype_type = ArchetypeType.ADVOCATE
            confidence = persuasiveness / 100
        elif civility >= 85 and counterargument >= 70:
            archetype_type = ArchetypeType.DIPLOMAT
            confidence = (civility + counterargument) / 200
        elif structure >= 70 and counterargument >= 70:
            archetype_type = ArchetypeType.PHILOSOPHER
            confidence = (structure + counterargument) / 200

        return {
            "type": archetype_type.value,
            "confidence": round(confidence, 2),
            "description": self._get_archetype_description(archetype_type),
        }

    def _get_archetype_description(self, archetype: ArchetypeType) -> str:
        """Get description for archetype"""
        descriptions = {
            ArchetypeType.PROFESSOR: "Data-driven educator who leads with evidence and citations",
            ArchetypeType.SOCRATIC: "Question-based guide who draws out contradictions",
            ArchetypeType.ANALYST: "Systematic breakdown specialist focused on logic",
            ArchetypeType.ADVOCATE: "Passionate defender who argues with conviction",
            ArchetypeType.PHILOSOPHER: "Abstract thinker who explores foundational assumptions",
            ArchetypeType.DIPLOMAT: "Bridge-builder who seeks common ground",
            ArchetypeType.CONTRARIAN: "Devil's advocate who challenges consensus",
            ArchetypeType.EMPIRICIST: "Experience-based arguer who relies on real-world examples",
            ArchetypeType.GENERALIST: "Balanced debater without dominant style",
        }
        return descriptions.get(archetype, "Balanced debater")


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Analyze a Reddit user's debate patterns"
    )
    parser.add_argument("username", help="Reddit username to analyze")
    parser.add_argument(
        "--max-comments",
        type=int,
        default=500,
        help="Maximum comments to fetch (default: 500)",
    )
    parser.add_argument(
        "--max-threads",
        type=int,
        default=100,
        help="Maximum threads to analyze (default: 100)",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Ignore cached data and re-analyze",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Run pipeline
    pipeline = AnalysisPipeline()
    result = pipeline.analyze_user(
        username=args.username,
        max_comments=args.max_comments,
        max_threads=args.max_threads,
        force_refresh=args.force_refresh,
    )

    # Output results
    if result.success:
        print(f"\n✓ Analysis complete for u/{result.username}")
        print(f"  Debates found: {result.debates_found}")
        print(f"  Debates analyzed: {result.debates_analyzed}")
        print(f"  Execution time: {result.execution_time_seconds:.1f}s")
    else:
        print(f"\n✗ Analysis failed for u/{result.username}")
        print(f"  Error: {result.error}")

    return 0 if result.success else 1


if __name__ == "__main__":
    exit(main())

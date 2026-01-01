"""
FastAPI application for user debate analysis

Provides REST endpoints for:
- Fetching user debate profiles
- Triggering analysis jobs
- Checking analysis status
- Cache management
"""

import logging
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import Config
from cache.cache_manager import CacheManager
from data.reddit_fetcher import RedditFetcher
from analysis.claude_client import ClaudeClient
from analysis.debate_identifier import DebateIdentifier
from analysis.argument_analyzer import ArgumentAnalyzer
from analysis.profile_synthesizer import ProfileSynthesizer

logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Debate Analytics API",
    description="Analyze Reddit users' debate patterns and argumentation quality",
    version="0.1.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create router for versioned API
from fastapi import APIRouter
router = APIRouter(prefix="/api/v1")


# Request/Response models
class AnalyzeRequest(BaseModel):
    """Request to analyze a user"""
    force_refresh: bool = Field(default=False, description="Force re-analysis ignoring cache")
    max_comments: int = Field(default=500, ge=50, le=1000, description="Max comments to fetch")
    max_threads: int = Field(default=100, ge=10, le=500, description="Max threads to analyze")


class AnalysisStatus(BaseModel):
    """Status of an analysis job"""
    username: str
    status: str  # pending, in_progress, completed, failed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class UserProfileSummary(BaseModel):
    """Summary of a user's debate profile"""
    username: str
    cached: bool
    cached_at: Optional[datetime] = None
    debates_analyzed: int = 0
    overall_score: Optional[int] = None
    archetype: Optional[str] = None
    top_topics: list = []


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime
    version: str
    cache_stats: Optional[Dict[str, Any]] = None


# In-memory job tracking (would use Redis in production)
_analysis_jobs: Dict[str, AnalysisStatus] = {}


def get_config() -> Config:
    """Get configuration instance"""
    return Config()


def get_cache_manager() -> CacheManager:
    """Get cache manager instance"""
    config = get_config()
    return CacheManager(
        cache_dir=Path(config.cache_dir),
        ttl_hours=config.cache_ttl_hours,
    )


def get_reddit_fetcher() -> RedditFetcher:
    """Get Reddit fetcher instance"""
    return RedditFetcher()


def get_claude_client() -> ClaudeClient:
    """Get Claude client instance"""
    config = get_config()
    return ClaudeClient(
        api_key=config.anthropic_api_key,
        model=config.claude_model,
    )


# Health and status endpoints
@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    cache = get_cache_manager()

    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version="0.1.0",
        cache_stats=cache.get_cache_stats(),
    )


@router.get("/status")
async def api_status():
    """Get API status and configuration"""
    config = get_config()
    cache = get_cache_manager()

    return {
        "api_version": "0.1.0",
        "claude_model": config.claude_model,
        "cache_ttl_hours": config.cache_ttl_hours,
        "cache_stats": cache.get_cache_stats(),
        "active_jobs": len([j for j in _analysis_jobs.values() if j.status == "in_progress"]),
    }


# User profile endpoints
@router.get("/users/{username}/profile")
async def get_user_profile(
    username: str,
    include_debates: bool = Query(False, description="Include full debate list"),
    include_fallacies: bool = Query(False, description="Include fallacy details"),
    include_top_arguments: bool = Query(False, description="Include top arguments"),
    include_expertise: bool = Query(False, description="Include topic expertise details"),
):
    """
    Get a user's debate profile.

    Returns cached profile if available, otherwise returns summary
    indicating analysis is needed.
    """
    cache = get_cache_manager()

    # Check for cached profile
    cached_data = cache.get_user_cache(username)

    if cached_data is None:
        # No cached data - return indication that analysis is needed
        return {
            "username": username,
            "cached": False,
            "message": "No profile data available. Trigger analysis with POST /users/{username}/analyze",
            "analysis_available": False,
        }

    # Build response from cached data
    response = {
        "username": username,
        "cached": True,
        "cached_at": cached_data.get("_cached_at") or cached_data.get("analyzed_at"),
        "analysis_available": True,
    }

    # Core profile data
    if "overall_score" in cached_data:
        response["overall_score"] = cached_data["overall_score"]
    if "archetype" in cached_data:
        response["archetype"] = cached_data["archetype"]
    if "mbti" in cached_data:
        response["mbti"] = cached_data["mbti"]
    if "good_faith" in cached_data:
        response["good_faith"] = cached_data["good_faith"]
    if "quality_breakdown" in cached_data:
        response["quality_breakdown"] = cached_data["quality_breakdown"]
    if "knowledge_profile" in cached_data:
        response["knowledge_profile"] = cached_data["knowledge_profile"]
    if "signature_techniques" in cached_data:
        response["signature_techniques"] = cached_data["signature_techniques"]

    # Statistics
    response["stats"] = {
        "debates_analyzed": cached_data.get("debates_analyzed", 0),
        "total_comments": cached_data.get("total_comments", 0),
        "overall_score": cached_data.get("overall_score"),
    }

    # Optional detailed sections
    if include_debates and "debates" in cached_data:
        response["debates"] = cached_data["debates"]

    if include_fallacies and "fallacy_profile" in cached_data:
        response["fallacy_profile"] = cached_data["fallacy_profile"]

    if include_top_arguments and "top_arguments" in cached_data:
        response["top_arguments"] = cached_data["top_arguments"]

    if include_expertise and "topic_expertise" in cached_data:
        response["topic_expertise"] = cached_data["topic_expertise"]

    return response


@router.get("/users/{username}/fallacies")
async def get_user_fallacies(username: str):
    """Get user's fallacy profile"""
    cache = get_cache_manager()
    cached_data = cache.get_user_cache(username)

    if cached_data is None:
        raise HTTPException(status_code=404, detail="User profile not found")

    return {
        "username": username,
        "fallacy_profile": cached_data.get("fallacy_profile", {}),
    }


@router.get("/users/{username}/top-arguments")
async def get_user_top_arguments(
    username: str,
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(10, ge=1, le=50, description="Max arguments to return"),
):
    """Get user's top arguments"""
    cache = get_cache_manager()
    cached_data = cache.get_user_cache(username)

    if cached_data is None:
        raise HTTPException(status_code=404, detail="User profile not found")

    top_args = cached_data.get("top_arguments", [])

    # Filter by category if specified
    if category:
        top_args = [a for a in top_args if a.get("category") == category]

    return {
        "username": username,
        "top_arguments": top_args[:limit],
        "total_count": len(top_args),
        "signature_techniques": cached_data.get("signature_techniques", []),
    }


@router.get("/users/{username}/expertise")
async def get_user_expertise(username: str):
    """Get user's topic expertise"""
    cache = get_cache_manager()
    cached_data = cache.get_user_cache(username)

    if cached_data is None:
        raise HTTPException(status_code=404, detail="User profile not found")

    return {
        "username": username,
        "topic_expertise": cached_data.get("topic_expertise", []),
        "knowledge_profile": cached_data.get("knowledge_profile", {}),
    }


@router.get("/users/{username}/archetype")
async def get_user_archetype(username: str):
    """Get user's debate archetype and MBTI"""
    cache = get_cache_manager()
    cached_data = cache.get_user_cache(username)

    if cached_data is None:
        raise HTTPException(status_code=404, detail="User profile not found")

    return {
        "username": username,
        "archetype": cached_data.get("archetype", {}),
        "mbti": cached_data.get("mbti", {}),
    }


@router.post("/users/{username}/analyze")
async def analyze_user(
    username: str,
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks,
):
    """
    Trigger analysis for a Reddit user.

    This starts a background job to:
    1. Fetch user's Reddit comment history
    2. Identify debates from comments
    3. Analyze argument quality
    4. Generate profile

    Returns immediately with job ID for status polling.
    """
    cache = get_cache_manager()

    # Check if we have cached data and refresh not forced
    if not request.force_refresh:
        cached = cache.get_user_cache(username)
        if cached:
            return {
                "username": username,
                "status": "completed",
                "message": "Profile already cached. Use force_refresh=true to re-analyze.",
                "cached_at": cached.get("_cached_at"),
            }

    # Check if analysis already in progress
    if username in _analysis_jobs:
        job = _analysis_jobs[username]
        if job.status == "in_progress":
            return {
                "username": username,
                "status": "in_progress",
                "message": "Analysis already in progress",
                "started_at": job.started_at,
            }

    # Create job entry
    job = AnalysisStatus(
        username=username,
        status="pending",
        started_at=datetime.now(),
        progress={"stage": "queued"},
    )
    _analysis_jobs[username] = job

    # Queue background analysis
    background_tasks.add_task(
        run_analysis_pipeline,
        username,
        request.max_comments,
        request.max_threads,
    )

    return {
        "username": username,
        "status": "pending",
        "message": "Analysis job queued",
        "started_at": job.started_at,
    }


@router.get("/users/{username}/analyze/status")
async def get_analysis_status(username: str):
    """Get status of an analysis job"""
    if username not in _analysis_jobs:
        # Check cache for completed analysis
        cache = get_cache_manager()
        cached = cache.get_user_cache(username)

        if cached:
            return {
                "username": username,
                "status": "completed",
                "cached_at": cached.get("_cached_at"),
            }

        return {
            "username": username,
            "status": "not_found",
            "message": "No analysis job found for this user",
        }

    job = _analysis_jobs[username]
    return {
        "username": username,
        "status": job.status,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "progress": job.progress,
        "error": job.error,
    }


@router.delete("/users/{username}/cache")
async def invalidate_user_cache(username: str):
    """Invalidate cached data for a user"""
    cache = get_cache_manager()
    removed = cache.invalidate_user(username)

    return {
        "username": username,
        "cache_invalidated": removed,
    }


# Cache management endpoints
@router.get("/cache/stats")
async def get_cache_stats():
    """Get cache statistics"""
    cache = get_cache_manager()
    return cache.get_cache_stats()


@router.post("/cache/cleanup")
async def cleanup_cache():
    """Remove expired cache entries"""
    cache = get_cache_manager()
    removed = cache.cleanup_expired()

    return {
        "expired_entries_removed": removed,
        "current_stats": cache.get_cache_stats(),
    }


# Background analysis pipeline
async def run_analysis_pipeline(
    username: str,
    max_comments: int,
    max_threads: int,
):
    """
    Run the full analysis pipeline for a user.

    This is executed as a background task.
    """
    from dataclasses import asdict

    job = _analysis_jobs.get(username)
    if not job:
        return

    job.status = "in_progress"

    try:
        cache = get_cache_manager()
        reddit = get_reddit_fetcher()
        claude = get_claude_client()

        # Stage 1: Fetch Reddit data
        job.progress = {"stage": "fetching_data", "percent": 10}
        logger.info(f"Fetching Reddit data for u/{username}")

        user_data = reddit.fetch_user_data(
            username=username,
            max_comments=max_comments,
        )

        if not user_data["comments"]:
            job.status = "failed"
            job.error = "No comments found for user"
            return

        # Stage 2: Build debate threads
        job.progress = {"stage": "building_threads", "percent": 25}
        logger.info(f"Building debate threads for u/{username}")

        threads = reddit.build_debate_threads(
            username=username,
            comments=user_data["comments"],
            max_threads=max_threads,
        )

        # Stage 3: Identify debates
        job.progress = {"stage": "identifying_debates", "percent": 40}
        logger.info(f"Identifying debates for u/{username}")

        identifier = DebateIdentifier(claude)

        # Quick filter first
        potential_debates = identifier.quick_filter(threads)

        # Claude identification
        identified_threads = identifier.identify_debates(
            username=username,
            threads=potential_debates,
        )

        debates = [t for t in identified_threads if t.is_debate]

        if not debates:
            # No debates found
            profile_data = {
                "username": username,
                "overall_score": None,
                "debates_analyzed": 0,
                "total_comments": len(user_data["comments"]),
                "total_threads": len(threads),
                "message": "No debates found in comment history",
            }
            cache.set_user_cache(username, profile_data)
            job.status = "completed"
            job.completed_at = datetime.now()
            job.progress = {"stage": "completed", "percent": 100}
            return

        # Stage 4: Analyze argument quality
        job.progress = {"stage": "analyzing_arguments", "percent": 55}
        logger.info(f"Analyzing argument quality for u/{username}")

        analyzer = ArgumentAnalyzer(claude)
        quality_results = analyzer.analyze_debates_batch(debates)

        # Stage 5: Synthesize comprehensive profile
        job.progress = {"stage": "synthesizing_profile", "percent": 70}
        logger.info(f"Synthesizing comprehensive profile for u/{username}")

        synthesizer = ProfileSynthesizer(claude)
        synthesized_profile = synthesizer.synthesize(
            username=username,
            debates=debates,
            quality_results=quality_results,
            run_all_analyses=True,
        )

        job.progress = {"stage": "caching_results", "percent": 95}

        # Cache the profile
        profile_data = asdict(synthesized_profile)
        profile_data["total_threads"] = len(threads)
        cache.set_user_cache(username, profile_data)

        # Complete
        job.status = "completed"
        job.completed_at = datetime.now()
        job.progress = {"stage": "completed", "percent": 100}

        logger.info(f"Analysis complete for u/{username}: {len(debates)} debates analyzed")

    except Exception as e:
        logger.error(f"Analysis failed for u/{username}: {e}")
        job.status = "failed"
        job.error = str(e)
        job.completed_at = datetime.now()


# Mount router to app
app.include_router(router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "Debate Analytics API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

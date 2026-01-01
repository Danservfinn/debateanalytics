"""
Configuration management for the backend
"""

import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class Config:
    """Application configuration"""

    # API Keys
    anthropic_api_key: str

    # Claude settings
    claude_model: str = "claude-sonnet-4-20250514"
    claude_max_tokens: int = 4096
    claude_temperature: float = 0.3

    # Reddit settings
    reddit_user_agent: str = "ErisDebateAnalyzer/1.0 (Research Tool)"
    reddit_rate_limit_delay: float = 1.0
    reddit_max_comments: int = 500
    reddit_max_retries: int = 3

    # Cache settings
    cache_dir: Path = Path("cache")
    cache_ttl_hours: int = 24

    # Analysis settings
    min_debate_score: float = 0.3
    max_debates_per_user: int = 100
    batch_size: int = 10

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables"""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        cache_dir = Path(os.environ.get("CACHE_DIR", "cache"))
        cache_dir.mkdir(parents=True, exist_ok=True)

        return cls(
            anthropic_api_key=api_key,
            claude_model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
            cache_dir=cache_dir,
            cache_ttl_hours=int(os.environ.get("CACHE_TTL_HOURS", "24")),
            min_debate_score=float(os.environ.get("MIN_DEBATE_SCORE", "0.3")),
        )


# Global config instance (lazy loaded)
_config: Optional[Config] = None


def get_config() -> Config:
    """Get the global configuration instance"""
    global _config
    if _config is None:
        _config = Config.from_env()
    return _config

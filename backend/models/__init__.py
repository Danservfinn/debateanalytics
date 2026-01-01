"""
Data models for user analysis
"""

from .user_profile import (
    RedditComment,
    RedditPost,
    DebateThread,
    DebateMetadata,
    ArgumentQuality,
    FallacyInstance,
    TopArgument,
    UserProfile,
)

__all__ = [
    "RedditComment",
    "RedditPost",
    "DebateThread",
    "DebateMetadata",
    "ArgumentQuality",
    "FallacyInstance",
    "TopArgument",
    "UserProfile",
]

"""
JSON-based caching for analysis results
"""

import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, TypeVar, Type
from dataclasses import asdict, is_dataclass

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CacheManager:
    """
    Manages JSON-based caching for user analysis results.

    Features:
    - TTL-based expiration
    - Organized directory structure
    - Incremental updates
    - Cache statistics
    """

    def __init__(
        self,
        cache_dir: Path,
        ttl_hours: int = 24,
    ):
        self.cache_dir = Path(cache_dir)
        self.ttl = timedelta(hours=ttl_hours)

        # Create cache subdirectories
        self.users_dir = self.cache_dir / "users"
        self.debates_dir = self.cache_dir / "debates"
        self.analysis_dir = self.cache_dir / "analysis"

        for dir_path in [self.users_dir, self.debates_dir, self.analysis_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def _get_user_cache_path(self, username: str) -> Path:
        """Get cache file path for a user"""
        return self.users_dir / f"{username.lower()}.json"

    def _get_debate_cache_path(self, thread_id: str) -> Path:
        """Get cache file path for a debate thread"""
        return self.debates_dir / f"{thread_id}.json"

    def _get_analysis_cache_path(self, username: str, analysis_type: str) -> Path:
        """Get cache file path for an analysis result"""
        return self.analysis_dir / f"{username.lower()}_{analysis_type}.json"

    def _is_expired(self, cache_path: Path) -> bool:
        """Check if a cache file has expired"""
        if not cache_path.exists():
            return True

        mtime = datetime.fromtimestamp(cache_path.stat().st_mtime)
        return datetime.now() - mtime > self.ttl

    def _serialize(self, data: Any) -> Dict:
        """Convert dataclass or dict to serializable dict"""
        if is_dataclass(data) and not isinstance(data, type):
            return self._serialize_dataclass(data)
        elif isinstance(data, dict):
            return {k: self._serialize(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._serialize(item) for item in data]
        elif isinstance(data, datetime):
            return data.isoformat()
        elif hasattr(data, "value"):  # Enum
            return data.value
        else:
            return data

    def _serialize_dataclass(self, obj: Any) -> Dict:
        """Recursively serialize a dataclass"""
        result = {}
        for field_name in obj.__dataclass_fields__:
            value = getattr(obj, field_name)
            result[field_name] = self._serialize(value)
        return result

    def get_user_cache(self, username: str) -> Optional[Dict]:
        """
        Get cached user data if available and not expired.

        Args:
            username: Reddit username

        Returns:
            Cached data dict or None
        """
        cache_path = self._get_user_cache_path(username)

        if self._is_expired(cache_path):
            logger.debug(f"Cache miss or expired for user: {username}")
            return None

        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                logger.info(f"Cache hit for user: {username}")
                return data
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error reading cache for {username}: {e}")
            return None

    def set_user_cache(self, username: str, data: Any) -> bool:
        """
        Cache user data.

        Args:
            username: Reddit username
            data: Data to cache (dict or dataclass)

        Returns:
            True if successful
        """
        cache_path = self._get_user_cache_path(username)

        try:
            serialized = self._serialize(data)
            serialized["_cached_at"] = datetime.now().isoformat()
            serialized["_cache_version"] = "1.0"

            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(serialized, f, indent=2, ensure_ascii=False)

            logger.info(f"Cached data for user: {username}")
            return True
        except (TypeError, IOError) as e:
            logger.error(f"Error caching data for {username}: {e}")
            return False

    def get_analysis_cache(
        self,
        username: str,
        analysis_type: str,
    ) -> Optional[Dict]:
        """
        Get cached analysis result.

        Args:
            username: Reddit username
            analysis_type: Type of analysis (e.g., "debate_id", "quality", "profile")

        Returns:
            Cached analysis or None
        """
        cache_path = self._get_analysis_cache_path(username, analysis_type)

        if self._is_expired(cache_path):
            return None

        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error reading analysis cache: {e}")
            return None

    def set_analysis_cache(
        self,
        username: str,
        analysis_type: str,
        data: Any,
    ) -> bool:
        """
        Cache analysis result.

        Args:
            username: Reddit username
            analysis_type: Type of analysis
            data: Analysis data to cache

        Returns:
            True if successful
        """
        cache_path = self._get_analysis_cache_path(username, analysis_type)

        try:
            serialized = self._serialize(data)
            serialized["_cached_at"] = datetime.now().isoformat()
            serialized["_analysis_type"] = analysis_type

            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(serialized, f, indent=2, ensure_ascii=False)

            return True
        except (TypeError, IOError) as e:
            logger.error(f"Error caching analysis: {e}")
            return False

    def get_debate_cache(self, thread_id: str) -> Optional[Dict]:
        """Get cached debate thread data"""
        cache_path = self._get_debate_cache_path(thread_id)

        if self._is_expired(cache_path):
            return None

        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error reading debate cache: {e}")
            return None

    def set_debate_cache(self, thread_id: str, data: Any) -> bool:
        """Cache debate thread data"""
        cache_path = self._get_debate_cache_path(thread_id)

        try:
            serialized = self._serialize(data)
            serialized["_cached_at"] = datetime.now().isoformat()

            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(serialized, f, indent=2, ensure_ascii=False)

            return True
        except (TypeError, IOError) as e:
            logger.error(f"Error caching debate: {e}")
            return False

    def invalidate_user(self, username: str) -> bool:
        """
        Invalidate all cache entries for a user.

        Args:
            username: Reddit username

        Returns:
            True if any files were removed
        """
        removed = False
        username_lower = username.lower()

        # Remove user cache
        user_cache = self._get_user_cache_path(username)
        if user_cache.exists():
            user_cache.unlink()
            removed = True

        # Remove analysis caches
        for cache_file in self.analysis_dir.glob(f"{username_lower}_*.json"):
            cache_file.unlink()
            removed = True

        logger.info(f"Invalidated cache for user: {username}")
        return removed

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        stats = {
            "users_cached": len(list(self.users_dir.glob("*.json"))),
            "debates_cached": len(list(self.debates_dir.glob("*.json"))),
            "analyses_cached": len(list(self.analysis_dir.glob("*.json"))),
            "total_size_bytes": sum(
                f.stat().st_size
                for f in self.cache_dir.rglob("*.json")
            ),
        }
        stats["total_size_mb"] = round(stats["total_size_bytes"] / (1024 * 1024), 2)
        return stats

    def cleanup_expired(self) -> int:
        """
        Remove all expired cache entries.

        Returns:
            Number of files removed
        """
        removed = 0

        for cache_file in self.cache_dir.rglob("*.json"):
            if self._is_expired(cache_file):
                cache_file.unlink()
                removed += 1

        logger.info(f"Cleaned up {removed} expired cache entries")
        return removed

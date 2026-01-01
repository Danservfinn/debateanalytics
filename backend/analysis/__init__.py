"""
Claude-powered analysis modules
"""

from .claude_client import ClaudeClient
from .debate_identifier import DebateIdentifier
from .argument_analyzer import ArgumentAnalyzer
from .fallacy_analyzer import FallacyAnalyzer, FallacyProfile
from .archetype_analyzer import ArchetypeAnalyzer, ArchetypeResult, MBTIResult
from .top_arguments import TopArgumentsAnalyzer, TopArgumentsResult
from .topic_expertise import TopicExpertiseAnalyzer, TopicExpertiseResult

__all__ = [
    "ClaudeClient",
    "DebateIdentifier",
    "ArgumentAnalyzer",
    "FallacyAnalyzer",
    "FallacyProfile",
    "ArchetypeAnalyzer",
    "ArchetypeResult",
    "MBTIResult",
    "TopArgumentsAnalyzer",
    "TopArgumentsResult",
    "TopicExpertiseAnalyzer",
    "TopicExpertiseResult",
]

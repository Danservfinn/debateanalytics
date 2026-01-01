"""
Eris Debate Analytics Backend
User debate analysis pipeline using Claude
"""

__version__ = "0.1.0"

from .config import Config
from .pipeline import AnalysisPipeline, PipelineResult

__all__ = [
    "Config",
    "AnalysisPipeline",
    "PipelineResult",
]

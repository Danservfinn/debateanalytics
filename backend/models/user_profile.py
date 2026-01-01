"""
Data models for user debate analysis
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class FallacyType(str, Enum):
    """Logical fallacy types"""
    AD_HOMINEM = "ad_hominem"
    STRAWMAN = "strawman"
    FALSE_DICHOTOMY = "false_dichotomy"
    APPEAL_TO_AUTHORITY = "appeal_to_authority"
    APPEAL_TO_EMOTION = "appeal_to_emotion"
    APPEAL_TO_POPULARITY = "appeal_to_popularity"
    RED_HERRING = "red_herring"
    WHATABOUTISM = "whataboutism"
    HASTY_GENERALIZATION = "hasty_generalization"
    SLIPPERY_SLOPE = "slippery_slope"
    CIRCULAR_REASONING = "circular_reasoning"
    MOVING_GOALPOSTS = "moving_goalposts"
    NO_TRUE_SCOTSMAN = "no_true_scotsman"
    FALSE_CAUSE = "false_cause"
    APPEAL_TO_NATURE = "appeal_to_nature"
    GENETIC_FALLACY = "genetic_fallacy"
    SEALIONING = "sealioning"
    GISH_GALLOP = "gish_gallop"
    BURDEN_SHIFTING = "burden_shifting"
    CHERRY_PICKING = "cherry_picking"
    EQUIVOCATION = "equivocation"
    BEGGING_THE_QUESTION = "begging_the_question"


class FallacySeverity(str, Enum):
    """Fallacy severity levels"""
    MINOR = "minor"
    MODERATE = "moderate"
    SIGNIFICANT = "significant"
    SEVERE = "severe"


class ArchetypeType(str, Enum):
    """Debate archetype classifications"""
    PROFESSOR = "professor"
    SOCRATIC = "socratic"
    ANALYST = "analyst"
    ADVOCATE = "advocate"
    PHILOSOPHER = "philosopher"
    PRAGMATIST = "pragmatist"
    DEVILS_ADVOCATE = "devils_advocate"
    MEDIATOR = "mediator"
    PROSECUTOR = "prosecutor"
    STORYTELLER = "storyteller"


class ArgumentCategory(str, Enum):
    """Categories for top arguments"""
    MOST_PERSUASIVE = "most_persuasive"
    BEST_EVIDENCED = "best_evidenced"
    MOST_INSIGHTFUL = "most_insightful"
    BEST_STRUCTURED = "best_structured"
    MOST_ENGAGING = "most_engaging"


@dataclass
class RedditComment:
    """A Reddit comment with metadata"""
    id: str
    author: str
    body: str
    score: int
    created_utc: float
    parent_id: str
    link_id: str
    subreddit: str
    permalink: str
    depth: int = 0
    is_submitter: bool = False

    @property
    def is_reply_to_comment(self) -> bool:
        return self.parent_id.startswith("t1_")

    @property
    def word_count(self) -> int:
        return len(self.body.split())

    @property
    def created_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.created_utc)

    @property
    def url(self) -> str:
        return f"https://reddit.com{self.permalink}"


@dataclass
class RedditPost:
    """A Reddit post/submission"""
    id: str
    author: str
    title: str
    selftext: str
    score: int
    num_comments: int
    created_utc: float
    subreddit: str
    permalink: str
    url: str

    @property
    def word_count(self) -> int:
        return len(self.selftext.split()) if self.selftext else 0


@dataclass
class DebateMetadata:
    """Metadata about a debate exchange"""
    topic: str
    topic_category: str
    user_position: Optional[str] = None
    opponent_position: Optional[str] = None
    exchange_depth: int = 0
    is_ongoing: bool = False
    apparent_outcome: str = "unresolved"  # user_won, opponent_won, draw, unresolved


@dataclass
class DebateThread:
    """A thread where the user engaged in debate"""
    thread_id: str
    thread_title: str
    thread_url: str
    subreddit: str
    user_is_op: bool
    user_comments: List[RedditComment]
    opponent_comments: List[RedditComment] = field(default_factory=list)
    metadata: Optional[DebateMetadata] = None
    debate_score: float = 0.0
    is_debate: bool = False
    confidence: float = 0.0

    @property
    def user_comment_count(self) -> int:
        return len(self.user_comments)

    @property
    def total_words(self) -> int:
        return sum(c.word_count for c in self.user_comments)

    @property
    def max_depth(self) -> int:
        return max((c.depth for c in self.user_comments), default=0)


@dataclass
class ArgumentQuality:
    """Quality assessment of an argument/debate"""
    debate_id: str
    overall_score: int  # 0-100

    structure_score: int  # 0-100
    structure_notes: str

    evidence_score: int  # 0-100
    evidence_notes: str
    citation_count: int = 0
    citations: List[Dict[str, Any]] = field(default_factory=list)

    counterargument_score: int  # 0-100
    counterargument_notes: str
    addresses_opponent_points: bool = False
    steelmans_opponent: bool = False
    strawmans_opponent: bool = False

    persuasiveness_score: int  # 0-100
    changed_opponent_mind: bool = False
    opponent_concession_quote: Optional[str] = None

    civility_score: int  # 0-100
    personal_attacks: bool = False
    condescension: bool = False

    is_top_argument_candidate: bool = False
    top_argument_reasons: List[str] = field(default_factory=list)


@dataclass
class FallacyInstance:
    """A detected logical fallacy instance"""
    id: str
    fallacy_type: FallacyType
    confidence: float  # 0-1
    severity: FallacySeverity

    user_statement: str
    user_statement_context: Optional[str] = None
    opponent_actual_statement: Optional[str] = None
    explanation: str = ""

    comment_id: str = ""
    comment_url: str = ""
    subreddit: str = ""
    timestamp: Optional[datetime] = None

    disputed: bool = False
    dispute_status: Optional[str] = None  # pending, upheld, overturned


@dataclass
class TopArgument:
    """A top-ranked argument from the user"""
    rank: int
    debate_id: str
    comment_id: str
    comment_url: str
    subreddit: str
    thread_title: str
    timestamp: datetime

    context_summary: str
    argument_snippet: str
    full_argument_text: Optional[str] = None

    quality_score: int = 0  # 0-100
    quality_breakdown: Optional[ArgumentQuality] = None
    categories: List[ArgumentCategory] = field(default_factory=list)
    strength_factors: List[str] = field(default_factory=list)

    # Outcome
    delta_awarded: bool = False
    opponent_concession: bool = False
    opponent_quote: Optional[str] = None
    karma: int = 0
    reply_count: int = 0
    quality_replies: int = 0

    techniques_used: List[str] = field(default_factory=list)


@dataclass
class FallacyProfile:
    """Aggregated fallacy profile for a user"""
    total_debates: int
    debates_with_fallacies: int
    fallacy_rate: float  # percentage

    by_type: Dict[FallacyType, Dict[str, Any]] = field(default_factory=dict)
    # Each entry: {count, percentage, instances, trend, last_occurrence}

    monthly_trend: List[Dict[str, Any]] = field(default_factory=list)
    improvement_percentage: float = 0.0

    vs_average: float = 0.0  # compared to baseline
    percentile: int = 50


@dataclass
class Archetype:
    """A debate archetype classification"""
    type: ArchetypeType
    confidence: float
    description: str
    evidence: List[str] = field(default_factory=list)
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)


@dataclass
class MBTIDimension:
    """A single MBTI dimension assessment"""
    result: str  # E/I, S/N, T/F, J/P
    score: int  # 0-100 (percentage toward one side)
    evidence: List[str] = field(default_factory=list)


@dataclass
class MBTIAssessment:
    """Full MBTI assessment based on debate patterns"""
    type: str  # e.g., "INTJ"
    label: str  # e.g., "The Architect"
    confidence: float

    e_i: MBTIDimension = field(default_factory=lambda: MBTIDimension("I", 50))
    s_n: MBTIDimension = field(default_factory=lambda: MBTIDimension("N", 50))
    t_f: MBTIDimension = field(default_factory=lambda: MBTIDimension("T", 50))
    j_p: MBTIDimension = field(default_factory=lambda: MBTIDimension("J", 50))

    debate_implications: List[str] = field(default_factory=list)


@dataclass
class DebatePersonality:
    """Complete debate personality profile"""
    primary_archetype: Archetype
    secondary_archetype: Optional[Archetype] = None
    mbti: Optional[MBTIAssessment] = None


@dataclass
class GoodFaithAssessment:
    """Assessment of whether user argues in good faith"""
    score: int  # 0-100
    summary: str
    recommendation: str

    positive_indicators: List[Dict[str, Any]] = field(default_factory=list)
    red_flags: List[Dict[str, Any]] = field(default_factory=list)
    behavioral_patterns: Dict[str, str] = field(default_factory=dict)

    worth_engaging: bool = True
    best_topics: List[str] = field(default_factory=list)
    approach_with_caution: List[str] = field(default_factory=list)
    suggested_approach: str = ""


@dataclass
class TopicExpertise:
    """Expertise level in a topic area"""
    topic: str
    topic_category: str
    debate_count: int
    expertise_score: int  # 0-100
    description: str = ""


@dataclass
class TrendAnalysis:
    """Analysis of trends over time"""
    overall_trajectory: str  # improving, stable, declining

    quality_trend: Dict[str, Any] = field(default_factory=dict)
    fallacy_trend: Dict[str, Any] = field(default_factory=dict)
    notable_changes: List[str] = field(default_factory=list)

    monthly_data: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class UserProfile:
    """Complete user debate profile"""
    username: str
    profile_version: str
    generated_at: datetime
    debates_analyzed: int
    analysis_period_start: Optional[datetime] = None
    analysis_period_end: Optional[datetime] = None

    # Core assessments
    good_faith: Optional[GoodFaithAssessment] = None
    personality: Optional[DebatePersonality] = None
    fallacy_profile: Optional[FallacyProfile] = None

    # Lists
    top_arguments: List[TopArgument] = field(default_factory=list)
    topic_expertise: List[TopicExpertise] = field(default_factory=list)
    debates: List[DebateThread] = field(default_factory=list)

    # Trends
    trends: Optional[TrendAnalysis] = None

    # Comparative context
    overall_percentile: int = 50
    dimension_percentiles: Dict[str, int] = field(default_factory=dict)

    # Executive summary
    one_liner: str = ""
    strengths: List[str] = field(default_factory=list)
    areas_for_improvement: List[str] = field(default_factory=list)
    notable_achievements: List[str] = field(default_factory=list)

    # Raw data
    raw_comments: List[RedditComment] = field(default_factory=list)

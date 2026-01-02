import { DebateThread, ThreadVerdict, DebateComment, DebatePosition, DebaterArchetype } from '@/types/debate';

// Local participant type matching ThreadAnalysisResult.participants
export interface ThreadParticipant {
  username: string;
  commentCount: number;
  averageQuality: number;
  position: DebatePosition;
  archetype?: DebaterArchetype;
  isCached: boolean;
}

export interface NarrativeData {
  // Section 1: Thesis
  thesis: {
    originalClaim: string;
    context: string;
    opConfidence: 'high' | 'medium' | 'low';
    postedAt: string;
  };

  // Section 2: Positions
  positions: {
    pro: {
      debaterCount: number;
      keyArguments: ArgumentSummary[];
    };
    con: {
      debaterCount: number;
      keyArguments: ArgumentSummary[];
    };
    summary: string;
  };

  // Section 3: Turning Points
  turningPoints: TurningPoint[];

  // Section 4: Resolution
  resolution: {
    winner: 'pro' | 'con' | 'draw' | 'unresolved';
    winnerScore: string;
    summary: string;
    keyTakeaways: string[];
    unresolvedQuestions: string[];
    qualityMetrics: {
      discourseQuality: number;
      evidenceDensity: number;
      mindChanges: number;
    };
  };
}

export interface ArgumentSummary {
  text: string;
  strength: number;
  icon: 'chart' | 'link' | 'microscope' | 'book' | 'lightbulb' | 'scale';
  author?: string;
  commentId?: string;
}

export interface TurningPoint {
  id: string;
  type: 'evidence' | 'delta' | 'counter' | 'concession' | 'reframe';
  label: string;
  timeOffset: string;
  quote: string;
  author: string;
  authorAvatar?: string;
  score?: number;
  impact: string;
  fallacyDetected?: string;
  isMajor?: boolean;
}

export interface ThreadNarrativeProps {
  title: string;
  verdict: ThreadVerdict;
  debates: DebateThread[];
  participants: ThreadParticipant[];
  createdAt: string;
  threadUrl?: string;
  onJumpToComment?: (commentId: string) => void;
}

// Helper to derive narrative data from raw thread analysis
export function deriveNarrativeData(
  title: string,
  verdict: ThreadVerdict,
  debates: DebateThread[],
  participants: ThreadParticipant[],
  createdAt: string
): NarrativeData {
  // Extract thesis from title (CMV format)
  const thesis = extractThesis(title, verdict, createdAt);

  // Analyze positions from debates
  const positions = analyzePositions(debates, participants);

  // Extract turning points from debate momentum
  const turningPoints = extractTurningPoints(debates);

  // Build resolution from verdict and debates
  const resolution = buildResolution(verdict, debates);

  return {
    thesis,
    positions,
    turningPoints,
    resolution,
  };
}

function extractThesis(title: string, verdict: ThreadVerdict, createdAt: string): NarrativeData['thesis'] {
  // Remove CMV: prefix if present
  let claim = title.replace(/^CMV:\s*/i, '').trim();

  // Determine OP confidence from verdict
  const confidence: 'high' | 'medium' | 'low' =
    verdict.overallScore >= 7 ? 'high' :
    verdict.overallScore >= 4 ? 'medium' : 'low';

  return {
    originalClaim: claim,
    context: verdict.summary || 'A debate was sparked around this thesis, drawing multiple perspectives and evidence-based arguments.',
    opConfidence: confidence,
    postedAt: createdAt,
  };
}

function analyzePositions(debates: DebateThread[], _participants: ThreadParticipant[]): NarrativeData['positions'] {
  const proArgs: ArgumentSummary[] = [];
  const conArgs: ArgumentSummary[] = [];
  const allProArgs: ArgumentSummary[] = [];
  const allConArgs: ArgumentSummary[] = [];
  let proDebaters = new Set<string>();
  let conDebaters = new Set<string>();

  debates.forEach(debate => {
    debate.replies.forEach(reply => {
      const argSummary: ArgumentSummary = {
        text: truncateText(reply.text, 120),
        strength: reply.qualityScore,
        icon: getArgumentIcon(reply),
        author: reply.author,
        commentId: reply.id,
      };

      if (reply.position === 'pro') {
        proDebaters.add(reply.author);
        allProArgs.push(argSummary);
        if (reply.qualityScore >= 7) {
          proArgs.push(argSummary);
        }
      } else if (reply.position === 'con') {
        conDebaters.add(reply.author);
        allConArgs.push(argSummary);
        if (reply.qualityScore >= 7) {
          conArgs.push(argSummary);
        }
      }
    });
  });

  // Sort by strength
  proArgs.sort((a, b) => b.strength - a.strength);
  conArgs.sort((a, b) => b.strength - a.strength);
  allProArgs.sort((a, b) => b.strength - a.strength);
  allConArgs.sort((a, b) => b.strength - a.strength);

  // If no strong arguments found but there are debaters, show top arguments anyway
  const finalProArgs = proArgs.length > 0 ? proArgs : allProArgs;
  const finalConArgs = conArgs.length > 0 ? conArgs : allConArgs;

  const proWins = debates.filter(d => d.winner === 'pro').length;
  const conWins = debates.filter(d => d.winner === 'con').length;

  let summary = '';
  if (conWins > proWins) {
    summary = `The CON side assembled stronger evidence, particularly around peer-reviewed research and historical precedent.`;
  } else if (proWins > conWins) {
    summary = `The PRO side built a more compelling case through well-documented evidence and logical consistency.`;
  } else {
    summary = `Both sides presented equally compelling arguments, leading to a nuanced outcome.`;
  }

  return {
    pro: {
      debaterCount: proDebaters.size,
      keyArguments: finalProArgs.slice(0, 3),
    },
    con: {
      debaterCount: conDebaters.size,
      keyArguments: finalConArgs.slice(0, 3),
    },
    summary,
  };
}

function extractTurningPoints(debates: DebateThread[]): TurningPoint[] {
  const turningPoints: TurningPoint[] = [];
  let timeCounter = 0;

  debates.forEach(debate => {
    // Check for momentum shifts
    if (debate.momentumShifts) {
      debate.momentumShifts.forEach((shift, idx) => {
        turningPoints.push({
          id: `shift-${debate.id}-${idx}`,
          type: shift.fromPosition !== shift.toPosition ? 'counter' : 'evidence',
          label: formatShiftLabel(shift.trigger),
          timeOffset: `+${Math.floor(timeCounter / 60)} hours`,
          quote: truncateText(shift.trigger || '', 200),
          author: 'Participant',
          impact: shift.trigger || 'This moment shifted the debate dynamics.',
          isMajor: Math.abs(shift.qualityDelta) >= 3,
        });
        timeCounter += 30;
      });
    }

    // Find high-quality arguments that could be turning points
    debate.replies.forEach(reply => {
      if (reply.qualityScore >= 8.5 && !reply.isConcession) {
        turningPoints.push({
          id: reply.id,
          type: 'evidence',
          label: 'Strong Argument',
          timeOffset: formatTimeOffset(reply.createdAt),
          quote: truncateText(reply.text, 200),
          author: reply.author,
          score: reply.karma,
          impact: `This ${reply.position === 'pro' ? 'supporting' : 'challenging'} argument scored ${reply.qualityScore.toFixed(1)}/10 for logical strength.`,
          isMajor: reply.qualityScore >= 9,
        });
      }

      // Concessions are always turning points
      if (reply.isConcession) {
        turningPoints.push({
          id: reply.id,
          type: 'concession',
          label: 'Concession Made',
          timeOffset: formatTimeOffset(reply.createdAt),
          quote: truncateText(reply.text, 200),
          author: reply.author,
          impact: `${reply.author} acknowledged a valid point from the opposing side.`,
          isMajor: true,
        });
      }

      // Check for fallacies in counter-arguments
      if (reply.fallacies && reply.fallacies.length > 0) {
        turningPoints.push({
          id: `fallacy-${reply.id}`,
          type: 'counter',
          label: 'Counter-Evidence Attempt',
          timeOffset: formatTimeOffset(reply.createdAt),
          quote: truncateText(reply.text, 150),
          author: reply.author,
          impact: `This argument was weakened by logical issues.`,
          fallacyDetected: reply.fallacies[0].type,
          isMajor: false,
        });
      }
    });
  });

  // Sort by importance (major first) and limit
  turningPoints.sort((a, b) => (b.isMajor ? 1 : 0) - (a.isMajor ? 1 : 0));

  return turningPoints.slice(0, 5);
}

function buildResolution(verdict: ThreadVerdict, debates: DebateThread[]): NarrativeData['resolution'] {
  const proWins = debates.filter(d => d.winner === 'pro').length;
  const conWins = debates.filter(d => d.winner === 'con').length;

  const winner = verdict.winningPosition ||
    (conWins > proWins ? 'con' : proWins > conWins ? 'pro' : 'draw');

  const deltaCount = debates.reduce((count, debate) => {
    return count + debate.replies.filter(r => r.isConcession).length;
  }, 0);

  return {
    winner: winner as 'pro' | 'con' | 'draw' | 'unresolved',
    winnerScore: `${Math.max(proWins, conWins)}-${Math.min(proWins, conWins)} in substantive debates`,
    summary: verdict.conclusion || verdict.summary ||
      `The debate concluded with the ${winner === 'pro' ? 'supporting' : winner === 'con' ? 'challenging' : 'neither'} position prevailing based on evidence quality and logical consistency.`,
    keyTakeaways: verdict.keyTakeaways || [
      'Multiple perspectives were presented with supporting evidence',
      'Key claims were examined and partially verified',
      'The discourse remained largely civil throughout',
    ],
    unresolvedQuestions: [
      'Long-term implications remain debated in broader literature',
      'Some edge cases were not fully addressed',
    ],
    qualityMetrics: {
      discourseQuality: verdict.civilityScore || 7,
      evidenceDensity: verdict.evidenceQualityPct || 50,
      mindChanges: deltaCount,
    },
  };
}

// Utility functions
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function getArgumentIcon(reply: DebateComment): ArgumentSummary['icon'] {
  const text = reply.text.toLowerCase();
  if (text.includes('study') || text.includes('research') || text.includes('peer-reviewed')) return 'microscope';
  if (text.includes('data') || text.includes('statistic') || text.includes('%')) return 'chart';
  if (text.includes('source') || text.includes('link') || text.includes('http')) return 'link';
  if (text.includes('history') || text.includes('historical') || text.includes('tradition')) return 'book';
  if (text.includes('therefore') || text.includes('logic') || text.includes('reason')) return 'scale';
  return 'lightbulb';
}

function formatShiftLabel(type: string): string {
  switch (type) {
    case 'delta_awarded': return 'Delta Awarded';
    case 'strong_rebuttal': return 'Strong Rebuttal';
    case 'evidence_drop': return 'Key Evidence Introduced';
    case 'concession': return 'Concession Made';
    default: return 'Momentum Shift';
  }
}

function formatTimeOffset(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return '+<1 hour';
    if (diffHours < 24) return `+${diffHours} hours`;
    return `+${Math.floor(diffHours / 24)} days`;
  } catch {
    return '+2 hours';
  }
}

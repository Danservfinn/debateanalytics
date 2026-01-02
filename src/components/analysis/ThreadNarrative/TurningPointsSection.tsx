'use client';

import { motion } from 'framer-motion';
import {
  Zap,
  Lightbulb,
  Triangle,
  RotateCcw,
  MessageSquare,
  RefreshCw,
  ArrowUp,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { TurningPoint } from './types';

interface TurningPointsSectionProps {
  turningPoints: TurningPoint[];
  isActive: boolean;
  onJumpToComment?: (commentId: string) => void;
}

const typeConfig = {
  evidence: {
    icon: Lightbulb,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    lineColor: 'bg-yellow-500',
  },
  delta: {
    icon: Triangle,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    lineColor: 'bg-green-500',
  },
  counter: {
    icon: RotateCcw,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    lineColor: 'bg-orange-500',
  },
  concession: {
    icon: MessageSquare,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    lineColor: 'bg-blue-500',
  },
  reframe: {
    icon: RefreshCw,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    lineColor: 'bg-purple-500',
  },
};

export function TurningPointsSection({
  turningPoints,
  isActive,
  onJumpToComment,
}: TurningPointsSectionProps) {
  const deltaCount = turningPoints.filter(tp => tp.type === 'delta').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0.5, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`transition-all duration-300 ${isActive ? '' : 'scale-98'}`}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">Turning Points</h3>
          <p className="text-sm text-zinc-500">The moments that shifted the debate...</p>
        </div>
        {deltaCount > 0 && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
            <Triangle className="w-3.5 h-3.5 text-green-400" />
            <span className="text-sm text-green-400 font-medium">
              {deltaCount} mind{deltaCount !== 1 ? 's' : ''} changed
            </span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {turningPoints.length > 0 ? (
          <div className="space-y-4">
            {turningPoints.map((tp, index) => (
              <TurningPointCard
                key={tp.id}
                turningPoint={tp}
                index={index}
                isLast={index === turningPoints.length - 1}
                onJumpToComment={onJumpToComment}
              />
            ))}
          </div>
        ) : (
          <motion.div
            className="card-premium p-8 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Zap className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">
              No significant turning points identified in this debate.
            </p>
            <p className="text-zinc-500 text-sm mt-1">
              The discussion maintained a steady course without major momentum shifts.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

interface TurningPointCardProps {
  turningPoint: TurningPoint;
  index: number;
  isLast: boolean;
  onJumpToComment?: (commentId: string) => void;
}

function TurningPointCard({
  turningPoint,
  index,
  isLast,
  onJumpToComment,
}: TurningPointCardProps) {
  const config = typeConfig[turningPoint.type];
  const Icon = config.icon;

  const handleClick = () => {
    // Extract comment ID from the turningPoint.id (remove prefixes like "shift-", "fallacy-")
    const commentId = turningPoint.id.replace(/^(shift-|fallacy-)/, '');
    if (onJumpToComment) {
      onJumpToComment(commentId);
    }
  };

  return (
    <motion.div
      className="flex gap-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      {/* Timeline marker */}
      <div className="flex flex-col items-center">
        <motion.div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${config.bg} border ${config.border}
            ${turningPoint.isMajor ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-primary' : ''}
          `}
          whileHover={{ scale: 1.1 }}
        >
          <Icon className={`w-5 h-5 ${config.color}`} />
        </motion.div>
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-2 ${config.lineColor} opacity-30`} />
        )}
      </div>

      {/* Content */}
      <motion.div
        className={`
          flex-1 card-premium p-4 mb-2
          ${onJumpToComment ? 'cursor-pointer group hover:border-purple-500/30' : ''}
          ${turningPoint.isMajor ? 'border-l-2' : ''}
        `}
        style={{
          borderLeftColor: turningPoint.isMajor ? config.lineColor.replace('bg-', 'rgb(') + ')' : undefined,
        }}
        onClick={onJumpToComment ? handleClick : undefined}
        whileHover={onJumpToComment ? { x: 4 } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`
              text-xs font-semibold px-2 py-1 rounded-full
              ${config.bg} ${config.color}
            `}>
              {turningPoint.label}
            </span>
            {turningPoint.isMajor && (
              <span className="text-xs text-purple-400 font-medium">Major Shift</span>
            )}
          </div>
          <span className="text-xs text-zinc-500">{turningPoint.timeOffset}</span>
        </div>

        {/* Quote */}
        <blockquote className="text-sm text-zinc-300 leading-relaxed mb-3 pl-3 border-l-2 border-zinc-700">
          &ldquo;{turningPoint.quote}&rdquo;
        </blockquote>

        {/* Attribution */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
            <span className="text-xs text-zinc-400">
              {turningPoint.author.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm text-zinc-400">{turningPoint.author}</span>
          {turningPoint.score && turningPoint.score > 0 && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <ArrowUp className="w-3 h-3" />
              {turningPoint.score.toLocaleString()}
            </span>
          )}
          {onJumpToComment && (
            <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-purple-400 transition-colors ml-auto" />
          )}
        </div>

        {/* Impact */}
        <div className="bg-zinc-900/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-zinc-500 flex-shrink-0">Impact:</span>
            <p className="text-xs text-zinc-400 leading-relaxed">{turningPoint.impact}</p>
          </div>
          {turningPoint.fallacyDetected && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-orange-400">
                {turningPoint.fallacyDetected} detected
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

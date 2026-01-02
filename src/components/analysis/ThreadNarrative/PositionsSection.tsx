'use client';

import { motion } from 'framer-motion';
import {
  Users,
  Swords,
  Shield,
  BarChart3,
  Link2,
  Microscope,
  BookOpen,
  Lightbulb,
  Scale,
  ExternalLink,
} from 'lucide-react';
import { NarrativeData, ArgumentSummary } from './types';

interface PositionsSectionProps {
  positions: NarrativeData['positions'];
  isActive: boolean;
  onJumpToComment?: (commentId: string) => void;
}

const iconMap = {
  chart: BarChart3,
  link: Link2,
  microscope: Microscope,
  book: BookOpen,
  lightbulb: Lightbulb,
  scale: Scale,
};

export function PositionsSection({ positions, isActive, onJumpToComment }: PositionsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0.5, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`transition-all duration-300 ${isActive ? '' : 'scale-98'}`}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <Users className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">Positions Formed</h3>
          <p className="text-sm text-zinc-500">The battle lines were drawn...</p>
        </div>
        <div className="ml-auto">
          <span className="text-sm text-zinc-500">
            {positions.pro.debaterCount + positions.con.debaterCount} debaters engaged
          </span>
        </div>
      </div>

      {/* Two-column positions grid */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* PRO Side */}
        <motion.div
          className="card-premium p-5 border-l-4 border-l-green-500"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Swords className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h4 className="font-semibold text-green-400">Supporting OP</h4>
              <span className="text-xs text-zinc-500">
                {positions.pro.debaterCount} debater{positions.pro.debaterCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {positions.pro.keyArguments.length > 0 ? (
              positions.pro.keyArguments.map((arg, index) => (
                <ArgumentCard
                  key={index}
                  argument={arg}
                  position="pro"
                  onJumpToComment={onJumpToComment}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500 italic">
                No strong supporting arguments identified
              </p>
            )}
          </div>
        </motion.div>

        {/* CON Side */}
        <motion.div
          className="card-premium p-5 border-l-4 border-l-red-500"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h4 className="font-semibold text-red-400">Challenging OP</h4>
              <span className="text-xs text-zinc-500">
                {positions.con.debaterCount} debater{positions.con.debaterCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {positions.con.keyArguments.length > 0 ? (
              positions.con.keyArguments.map((arg, index) => (
                <ArgumentCard
                  key={index}
                  argument={arg}
                  position="con"
                  onJumpToComment={onJumpToComment}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500 italic">
                No strong challenging arguments identified
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Position Summary */}
      <motion.div
        className="glass-subtle rounded-xl p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-zinc-400 text-sm leading-relaxed">
          {positions.summary}
        </p>
      </motion.div>
    </motion.div>
  );
}

interface ArgumentCardProps {
  argument: ArgumentSummary;
  position: 'pro' | 'con';
  onJumpToComment?: (commentId: string) => void;
}

function ArgumentCard({ argument, position, onJumpToComment }: ArgumentCardProps) {
  const Icon = iconMap[argument.icon];
  const strengthColor =
    argument.strength >= 8 ? 'text-green-400' :
    argument.strength >= 6 ? 'text-yellow-400' : 'text-zinc-400';

  const handleClick = () => {
    if (argument.commentId && onJumpToComment) {
      onJumpToComment(argument.commentId);
    }
  };

  return (
    <motion.div
      className={`
        p-3 rounded-lg bg-zinc-900/50 border border-zinc-800
        hover:border-zinc-700 transition-all duration-200
        ${argument.commentId && onJumpToComment ? 'cursor-pointer group' : ''}
      `}
      onClick={handleClick}
      whileHover={argument.commentId ? { scale: 1.01 } : undefined}
    >
      <div className="flex items-start gap-3">
        <div className={`
          w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
          ${position === 'pro' ? 'bg-green-500/10' : 'bg-red-500/10'}
        `}>
          <Icon className={`w-3.5 h-3.5 ${position === 'pro' ? 'text-green-400' : 'text-red-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2">
            &ldquo;{argument.text}&rdquo;
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-medium ${strengthColor}`}>
              Strength: {argument.strength.toFixed(1)}
            </span>
            {argument.author && (
              <span className="text-xs text-zinc-500">
                — {argument.author}
              </span>
            )}
            {argument.commentId && onJumpToComment && (
              <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-purple-400 transition-colors ml-auto" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

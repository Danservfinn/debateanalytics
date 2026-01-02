'use client';

import { motion } from 'framer-motion';
import { Quote, Calendar, Gauge, Sparkles } from 'lucide-react';
import { NarrativeData } from './types';

interface ThesisSectionProps {
  thesis: NarrativeData['thesis'];
  isActive: boolean;
}

export function ThesisSection({ thesis, isActive }: ThesisSectionProps) {
  const confidenceConfig = {
    high: {
      label: 'High',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      description: 'OP is seeking strong counter-evidence',
    },
    medium: {
      label: 'Medium',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      description: 'OP is open to persuasion',
    },
    low: {
      label: 'Low',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      description: 'OP may already be questioning this view',
    },
  };

  const confidence = confidenceConfig[thesis.opConfidence];

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0.5, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`transition-all duration-300 ${isActive ? '' : 'scale-98'}`}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">The Thesis</h3>
          <p className="text-sm text-zinc-500">What sparked this debate?</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-zinc-500 text-sm">
          <Calendar className="w-4 h-4" />
          <span>{formatDate(thesis.postedAt)}</span>
        </div>
      </div>

      {/* Original Claim Card */}
      <motion.div
        className="card-premium p-6 mb-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-start gap-4">
          <Quote className="w-8 h-8 text-purple-400/50 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <blockquote className="text-xl font-medium text-zinc-100 leading-relaxed">
              &ldquo;{thesis.originalClaim}&rdquo;
            </blockquote>
          </div>
        </div>
      </motion.div>

      {/* Context */}
      <motion.div
        className="glass-subtle rounded-xl p-5 mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-zinc-400 leading-relaxed">
          {thesis.context}
        </p>
      </motion.div>

      {/* OP Confidence Indicator */}
      <motion.div
        className={`rounded-xl p-4 ${confidence.bg} border ${confidence.border}`}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <Gauge className={`w-5 h-5 ${confidence.color}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-300">OP&apos;s Conviction:</span>
              <span className={`text-sm font-semibold ${confidence.color}`}>
                {confidence.label}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {confidence.description}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle,
  Shield,
  Swords,
  Scale,
  HelpCircle,
  Check,
  AlertCircle,
  BarChart3,
  FileText,
  Triangle,
} from 'lucide-react';
import { NarrativeData } from './types';

interface ResolutionSectionProps {
  resolution: NarrativeData['resolution'];
  isActive: boolean;
}

const winnerConfig = {
  pro: {
    icon: Swords,
    label: 'PRO Position Prevails',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    gradient: 'from-green-500/20 to-transparent',
  },
  con: {
    icon: Shield,
    label: 'CON Position Prevails',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    gradient: 'from-red-500/20 to-transparent',
  },
  draw: {
    icon: Scale,
    label: 'Draw - No Clear Winner',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    gradient: 'from-yellow-500/20 to-transparent',
  },
  unresolved: {
    icon: HelpCircle,
    label: 'Unresolved',
    color: 'text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    gradient: 'from-zinc-500/20 to-transparent',
  },
};

export function ResolutionSection({ resolution, isActive }: ResolutionSectionProps) {
  const winner = winnerConfig[resolution.winner];
  const WinnerIcon = winner.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0.5, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`transition-all duration-300 ${isActive ? '' : 'scale-98'}`}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">Resolution</h3>
          <p className="text-sm text-zinc-500">Where the dust settled...</p>
        </div>
      </div>

      {/* Verdict Card */}
      <motion.div
        className={`
          card-premium p-6 mb-6 overflow-hidden relative
          border-2 ${winner.border}
        `}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${winner.gradient} opacity-50`} />

        <div className="relative">
          {/* Winner header */}
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-xl ${winner.bg} flex items-center justify-center`}>
              <WinnerIcon className={`w-7 h-7 ${winner.color}`} />
            </div>
            <div>
              <h4 className={`text-xl font-bold ${winner.color}`}>
                {winner.label}
              </h4>
              <span className="text-sm text-zinc-500">{resolution.winnerScore}</span>
            </div>
          </div>

          {/* Summary */}
          <p className="text-zinc-300 leading-relaxed">
            {resolution.summary}
          </p>
        </div>
      </motion.div>

      {/* Key Takeaways */}
      <motion.div
        className="card-premium p-5 mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Check className="w-4 h-4 text-green-400" />
          <h5 className="font-semibold text-zinc-200">Key Takeaways</h5>
        </div>
        <ul className="space-y-3">
          {resolution.keyTakeaways.map((takeaway, index) => (
            <motion.li
              key={index}
              className="flex items-start gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{takeaway}</p>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Unresolved Questions */}
      {resolution.unresolvedQuestions.length > 0 && (
        <motion.div
          className="glass-subtle rounded-xl p-5 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <h5 className="font-semibold text-zinc-200">Unresolved Questions</h5>
          </div>
          <ul className="space-y-2">
            {resolution.unresolvedQuestions.map((question, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-amber-400 text-sm">•</span>
                <p className="text-sm text-zinc-500 leading-relaxed">{question}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Quality Metrics */}
      <motion.div
        className="grid grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <MetricCard
          icon={BarChart3}
          label="Discourse Quality"
          value={`${resolution.qualityMetrics.discourseQuality.toFixed(1)}/10`}
          subtext="Civil, evidence-focused"
          color="purple"
        />
        <MetricCard
          icon={FileText}
          label="Evidence Density"
          value={`${Math.round(resolution.qualityMetrics.evidenceDensity)}%`}
          subtext="Claims with sources"
          color="blue"
        />
        <MetricCard
          icon={Triangle}
          label="Mind Changes"
          value={`${resolution.qualityMetrics.mindChanges}`}
          subtext={resolution.qualityMetrics.mindChanges === 1 ? 'Delta awarded' : 'Deltas awarded'}
          color="green"
        />
      </motion.div>
    </motion.div>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  color: 'purple' | 'blue' | 'green';
}

function MetricCard({ icon: Icon, label, value, subtext, color }: MetricCardProps) {
  const colorConfig = {
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      iconColor: 'text-purple-400',
      valueColor: 'text-purple-300',
    },
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-300',
    },
    green: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      iconColor: 'text-green-400',
      valueColor: 'text-green-300',
    },
  };

  const config = colorConfig[color];

  return (
    <div className={`card-premium p-4 ${config.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${config.iconColor}`} />
        </div>
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${config.valueColor} mb-1`}>
        {value}
      </div>
      <p className="text-xs text-zinc-500">{subtext}</p>
    </div>
  );
}

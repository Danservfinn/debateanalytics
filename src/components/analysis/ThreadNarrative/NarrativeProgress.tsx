'use client';

import { motion } from 'framer-motion';
import { FileText, Users, Zap, CheckCircle } from 'lucide-react';

interface NarrativeProgressProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const steps = [
  { id: 1, label: 'Thesis', icon: FileText },
  { id: 2, label: 'Positions', icon: Users },
  { id: 3, label: 'Turning Points', icon: Zap },
  { id: 4, label: 'Resolution', icon: CheckCircle },
];

export function NarrativeProgress({ currentStep, onStepClick }: NarrativeProgressProps) {
  return (
    <div className="w-full mb-8">
      {/* Desktop: Horizontal */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-zinc-800">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <motion.button
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              className={`
                relative z-10 flex flex-col items-center gap-2
                transition-all duration-300 group
                ${onStepClick ? 'cursor-pointer' : 'cursor-default'}
              `}
              whileHover={onStepClick ? { scale: 1.05 } : undefined}
              whileTap={onStepClick ? { scale: 0.98 } : undefined}
            >
              {/* Step circle */}
              <motion.div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  border-2 transition-all duration-300
                  ${isActive
                    ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/30'
                    : isCompleted
                      ? 'bg-purple-500 border-purple-500'
                      : 'bg-zinc-900 border-zinc-700 group-hover:border-zinc-600'
                  }
                `}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Icon
                  className={`
                    w-5 h-5 transition-colors duration-300
                    ${isActive
                      ? 'text-purple-400'
                      : isCompleted
                        ? 'text-white'
                        : 'text-zinc-500 group-hover:text-zinc-400'
                    }
                  `}
                />
              </motion.div>

              {/* Step label */}
              <span
                className={`
                  text-xs font-medium transition-colors duration-300
                  ${isActive
                    ? 'text-purple-400'
                    : isCompleted
                      ? 'text-zinc-300'
                      : 'text-zinc-500 group-hover:text-zinc-400'
                  }
                `}
              >
                {step.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <motion.div
                  className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-purple-500"
                  layoutId="activeIndicator"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Mobile: Compact horizontal */}
      <div className="flex md:hidden items-center justify-between px-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <motion.button
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              className="flex flex-col items-center gap-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  border transition-all duration-300
                  ${isActive
                    ? 'bg-purple-500/20 border-purple-500'
                    : isCompleted
                      ? 'bg-purple-500 border-purple-500'
                      : 'bg-zinc-900 border-zinc-700'
                  }
                `}
              >
                <Icon
                  className={`
                    w-4 h-4
                    ${isActive ? 'text-purple-400' : isCompleted ? 'text-white' : 'text-zinc-500'}
                  `}
                />
              </div>
              <span
                className={`
                  text-[10px] font-medium
                  ${isActive ? 'text-purple-400' : isCompleted ? 'text-zinc-300' : 'text-zinc-600'}
                `}
              >
                {step.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

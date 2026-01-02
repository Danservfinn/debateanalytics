'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { NarrativeProgress } from './NarrativeProgress';
import { ThesisSection } from './ThesisSection';
import { PositionsSection } from './PositionsSection';
import { TurningPointsSection } from './TurningPointsSection';
import { ResolutionSection } from './ResolutionSection';
import { ThreadNarrativeProps, deriveNarrativeData } from './types';

export function ThreadNarrative({
  title,
  verdict,
  debates,
  participants,
  createdAt,
  onJumpToComment,
}: ThreadNarrativeProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive narrative data from raw analysis
  const narrativeData = useMemo(() => {
    return deriveNarrativeData(title, verdict, debates, participants, createdAt);
  }, [title, verdict, debates, participants, createdAt]);

  // Auto-scroll to section when step changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  return (
    <motion.div
      className={`
        card-featured overflow-hidden transition-all duration-500
        ${isExpanded ? 'fixed inset-4 z-50' : 'relative'}
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-purple-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100">Debate Narrative</h2>
            <p className="text-xs text-zinc-500">Follow the story of this discussion</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Step counter */}
          <span className="text-sm text-zinc-500 mr-2">
            Step {currentStep} of 4
          </span>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-zinc-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-zinc-400" />
            )}
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="px-6 pt-6">
        <NarrativeProgress
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Content area */}
      <div
        ref={containerRef}
        className={`
          px-6 pb-6 overflow-y-auto
          ${isExpanded ? 'max-h-[calc(100vh-16rem)]' : 'max-h-[600px]'}
        `}
      >
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="thesis"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ThesisSection
                thesis={narrativeData.thesis}
                isActive={currentStep === 1}
              />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="positions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PositionsSection
                positions={narrativeData.positions}
                isActive={currentStep === 2}
                onJumpToComment={onJumpToComment}
              />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="turning-points"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TurningPointsSection
                turningPoints={narrativeData.turningPoints}
                isActive={currentStep === 3}
                onJumpToComment={onJumpToComment}
              />
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="resolution"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ResolutionSection
                resolution={narrativeData.resolution}
                isActive={currentStep === 4}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
      <div className="px-6 py-4 border-t border-zinc-800/50 flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            transition-all duration-200
            ${currentStep === 1
              ? 'opacity-50 cursor-not-allowed text-zinc-600'
              : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Previous</span>
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((step) => (
            <button
              key={step}
              onClick={() => handleStepClick(step)}
              className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${currentStep === step
                  ? 'bg-purple-500 w-6'
                  : currentStep > step
                    ? 'bg-purple-500/50'
                    : 'bg-zinc-700 hover:bg-zinc-600'
                }
              `}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={currentStep === 4}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            transition-all duration-200
            ${currentStep === 4
              ? 'opacity-50 cursor-not-allowed text-zinc-600'
              : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300'
            }
          `}
        >
          <span className="text-sm font-medium">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded overlay backdrop */}
      {isExpanded && (
        <motion.div
          className="fixed inset-0 bg-black/80 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsExpanded(false)}
        />
      )}
    </motion.div>
  );
}

// Re-export types for external use
export type { ThreadNarrativeProps, NarrativeData, TurningPoint, ArgumentSummary, ThreadParticipant } from './types';
export { deriveNarrativeData } from './types';

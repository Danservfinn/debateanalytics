/**
 * Framer Motion Animation Variants
 * Consistent animations following Miller's Law timing patterns
 */

import type { Variants, Transition } from 'framer-motion'

// ============================================
// Timing Constants
// ============================================

export const STAGGER_DELAY = 0.1
export const ENTRANCE_DURATION = 0.3
export const EXIT_DURATION = 0.2
export const CHART_REVEAL_DURATION = 0.8

// ============================================
// Spring Configurations
// ============================================

export const springConfig = {
  gentle: { stiffness: 120, damping: 14 },
  snappy: { stiffness: 400, damping: 25 },
  bouncy: { stiffness: 300, damping: 10 },
}

// ============================================
// Fade Variants
// ============================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: ENTRANCE_DURATION, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    transition: { duration: EXIT_DURATION, ease: 'easeIn' }
  }
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: ENTRANCE_DURATION, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: EXIT_DURATION, ease: 'easeIn' }
  }
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: ENTRANCE_DURATION, ease: 'easeOut' }
  }
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: ENTRANCE_DURATION, ease: 'easeOut' }
  }
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: ENTRANCE_DURATION, ease: 'easeOut' }
  }
}

// ============================================
// Scale Variants
// ============================================

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', ...springConfig.snappy }
  }
}

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', ...springConfig.bouncy }
  }
}

// ============================================
// Container/Stagger Variants
// ============================================

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER_DELAY,
      delayChildren: 0.1
    }
  }
}

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
}

// ============================================
// Card Variants
// ============================================

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: ENTRANCE_DURATION, ease: 'easeOut' }
  },
  hover: {
    y: -4,
    transition: { type: 'spring', ...springConfig.snappy }
  },
  tap: {
    scale: 0.98,
    transition: { type: 'spring', ...springConfig.snappy }
  }
}

// ============================================
// List Item Variants
// ============================================

export const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    x: 10,
    transition: { duration: 0.15, ease: 'easeIn' }
  }
}

// ============================================
// Chart Animation Variants
// ============================================

export const chartReveal: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: CHART_REVEAL_DURATION, ease: 'easeOut' }
  }
}

export const pieSlice: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      type: 'spring',
      ...springConfig.snappy
    }
  })
}

export const barGrow: Variants = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: (i: number) => ({
    scaleY: 1,
    opacity: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: 'easeOut'
    }
  })
}

// ============================================
// Timeline Node Variants
// ============================================

export const timelineNode: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', ...springConfig.bouncy }
  }
}

export const timelineLine: Variants = {
  hidden: { scaleY: 0 },
  visible: {
    scaleY: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
}

// ============================================
// Counter Animation
// ============================================

export const counterTransition: Transition = {
  duration: 1,
  ease: 'linear'
}

// ============================================
// Loading States
// ============================================

export const pulse: Variants = {
  initial: { opacity: 0.4 },
  animate: {
    opacity: [0.4, 0.8, 0.4],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
}

export const shimmer: Variants = {
  initial: { x: '-100%' },
  animate: {
    x: '100%',
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear'
    }
  }
}

// ============================================
// Modal/Overlay Variants
// ============================================

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 }
  }
}

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', ...springConfig.snappy }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 }
  }
}

// ============================================
// Hover Animations (for use with whileHover)
// ============================================

export const hoverLift = {
  y: -4,
  transition: { type: 'spring', ...springConfig.snappy }
}

export const hoverScale = {
  scale: 1.02,
  transition: { type: 'spring', ...springConfig.snappy }
}

export const hoverGlow = {
  boxShadow: '0 0 20px rgba(234, 88, 12, 0.3)',
  transition: { duration: 0.2 }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create staggered delay for index
 */
export function getStaggerDelay(index: number, baseDelay: number = STAGGER_DELAY): number {
  return index * baseDelay
}

/**
 * Create viewport animation trigger options
 */
export const viewportOptions = {
  once: true,
  margin: '-50px',
  amount: 0.3 as const
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Maximize2 } from 'lucide-react'

interface ExpandableTextProps {
  text: string
  className?: string
  lineClamp?: number
  author?: string
  position?: 'pro' | 'con' | 'neutral'
}

/**
 * ExpandableText - Text that can be clicked to show full content in a popup
 *
 * Shows truncated text with visual indicator that it's expandable.
 * Click to open a modal with the full text.
 */
export function ExpandableText({
  text,
  className = '',
  lineClamp = 2,
  author,
  position
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  // Check if text is actually truncated
  useEffect(() => {
    const el = textRef.current
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight)
    }
  }, [text])

  const positionColors = {
    pro: 'border-success/30',
    con: 'border-danger/30',
    neutral: 'border-border'
  }

  return (
    <>
      {/* Truncated text display */}
      <div
        className={`relative group ${isTruncated ? 'cursor-pointer' : ''}`}
        onClick={() => isTruncated && setIsExpanded(true)}
      >
        <p
          ref={textRef}
          className={`${className} ${lineClamp === 2 ? 'line-clamp-2' : lineClamp === 3 ? 'line-clamp-3' : 'line-clamp-1'}`}
        >
          {text}
        </p>

        {/* Expand indicator */}
        {isTruncated && (
          <div className="absolute bottom-0 right-0 flex items-center gap-1 bg-gradient-to-l from-card via-card to-transparent pl-6 pr-1">
            <Maximize2 className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      {/* Full text modal */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
              onClick={() => setIsExpanded(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                w-[90vw] max-w-2xl max-h-[80vh] overflow-auto
                bg-card border-2 ${position ? positionColors[position] : 'border-border'}
                rounded-xl shadow-2xl z-50 p-6`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {position && (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      position === 'pro' ? 'bg-success/20 text-success' :
                      position === 'con' ? 'bg-danger/20 text-danger' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {position.toUpperCase()}
                    </span>
                  )}
                  {author && (
                    <span className="text-sm text-muted-foreground">u/{author}</span>
                  )}
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Full text */}
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {text}
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default ExpandableText

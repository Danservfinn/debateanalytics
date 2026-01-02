'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface PositionDefinitions {
  proDefinition: string
  conDefinition: string
  question?: string
}

interface PositionLegendProps {
  definitions: PositionDefinitions
  variant?: 'inline' | 'compact' | 'tooltip'
  className?: string
}

/**
 * PositionLegend - Shows what PRO and CON mean in context
 *
 * Variants:
 * - inline: Full display with both definitions visible
 * - compact: Smaller inline display
 * - tooltip: Info icon that reveals definitions on hover
 */
export function PositionLegend({
  definitions,
  variant = 'compact',
  className = ''
}: PositionLegendProps) {
  if (variant === 'tooltip') {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ${className}`}>
              <Info className="w-3.5 h-3.5" />
              <span>Position Guide</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm p-3">
            <div className="space-y-2">
              {definitions.question && (
                <p className="text-xs text-muted-foreground mb-2 pb-2 border-b border-border">
                  <span className="font-medium">Question:</span> {definitions.question}
                </p>
              )}
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-success mt-1 shrink-0" />
                <div>
                  <span className="text-xs font-medium text-success">PRO</span>
                  <p className="text-xs text-foreground">{definitions.proDefinition}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-danger mt-1 shrink-0" />
                <div>
                  <span className="text-xs font-medium text-danger">CON</span>
                  <p className="text-xs text-foreground">{definitions.conDefinition}</p>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 text-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-muted-foreground">
            <span className="font-medium text-success">PRO:</span> {definitions.proDefinition}
          </span>
        </div>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-danger" />
          <span className="text-muted-foreground">
            <span className="font-medium text-danger">CON:</span> {definitions.conDefinition}
          </span>
        </div>
      </div>
    )
  }

  // Inline variant (full display)
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <div className="p-2.5 rounded-lg bg-success/10 border border-success/20">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs font-medium text-success">PRO</span>
        </div>
        <p className="text-xs text-foreground">{definitions.proDefinition}</p>
      </div>
      <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-2 h-2 rounded-full bg-danger" />
          <span className="text-xs font-medium text-danger">CON</span>
        </div>
        <p className="text-xs text-foreground">{definitions.conDefinition}</p>
      </div>
    </div>
  )
}

export default PositionLegend

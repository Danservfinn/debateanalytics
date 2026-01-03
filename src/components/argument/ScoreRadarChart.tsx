'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { ArgumentScore } from '@/types/argument'

interface ScoreRadarChartProps {
  scores: ArgumentScore[]
  size?: number
}

/**
 * Radar chart visualization for argument scores
 * Uses SVG for lightweight rendering
 */
export function ScoreRadarChart({ scores, size = 200 }: ScoreRadarChartProps) {
  const center = size / 2
  const maxRadius = (size / 2) - 20 // Leave padding for labels

  // Calculate points for each score
  const points = useMemo(() => {
    const numAxes = scores.length
    const angleStep = (2 * Math.PI) / numAxes
    const startAngle = -Math.PI / 2 // Start from top

    return scores.map((score, i) => {
      const angle = startAngle + i * angleStep
      const normalizedScore = score.score / 10 // Normalize to 0-1
      const radius = normalizedScore * maxRadius

      return {
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
        labelX: center + (maxRadius + 15) * Math.cos(angle),
        labelY: center + (maxRadius + 15) * Math.sin(angle),
        score: score.score,
        label: score.label.split(' ')[0], // First word only for compactness
        fullLabel: score.label,
        angle
      }
    })
  }, [scores, center, maxRadius])

  // Create polygon path for the score area
  const scorePath = useMemo(() => {
    if (points.length === 0) return ''
    const pathParts = points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    )
    return pathParts.join(' ') + ' Z'
  }, [points])

  // Create grid lines (concentric polygons at 25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0]
  const gridPaths = useMemo(() => {
    return gridLevels.map(level => {
      const numAxes = scores.length
      const angleStep = (2 * Math.PI) / numAxes
      const startAngle = -Math.PI / 2

      const gridPoints = scores.map((_, i) => {
        const angle = startAngle + i * angleStep
        const radius = level * maxRadius
        return {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle)
        }
      })

      const pathParts = gridPoints.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
      )
      return pathParts.join(' ') + ' Z'
    })
  }, [scores.length, center, maxRadius])

  // Create axis lines from center to each point
  const axisLines = useMemo(() => {
    const numAxes = scores.length
    const angleStep = (2 * Math.PI) / numAxes
    const startAngle = -Math.PI / 2

    return scores.map((_, i) => {
      const angle = startAngle + i * angleStep
      return {
        x1: center,
        y1: center,
        x2: center + maxRadius * Math.cos(angle),
        y2: center + maxRadius * Math.sin(angle)
      }
    })
  }, [scores.length, center, maxRadius])

  // Color based on average score
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length
  const fillColor = avgScore >= 7 ? 'rgba(34, 197, 94, 0.3)' :
                    avgScore >= 5 ? 'rgba(234, 179, 8, 0.3)' :
                    'rgba(239, 68, 68, 0.3)'
  const strokeColor = avgScore >= 7 ? 'rgb(34, 197, 94)' :
                      avgScore >= 5 ? 'rgb(234, 179, 8)' :
                      'rgb(239, 68, 68)'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        {/* Grid */}
        {gridPaths.map((path, i) => (
          <path
            key={`grid-${i}`}
            d={path}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={`axis-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        ))}

        {/* Score area */}
        <motion.path
          d={scorePath}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />

        {/* Score points */}
        {points.map((point, i) => (
          <motion.circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={strokeColor}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
          />
        ))}

        {/* Labels */}
        {points.map((point, i) => (
          <text
            key={`label-${i}`}
            x={point.labelX}
            y={point.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] fill-muted-foreground font-medium"
          >
            {point.label}
          </text>
        ))}
      </svg>

      {/* Center score */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-center">
          <span className="text-2xl font-bold" style={{ color: strokeColor }}>
            {avgScore.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground block">/10</span>
        </div>
      </motion.div>
    </div>
  )
}

export default ScoreRadarChart

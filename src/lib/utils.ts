import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number with commas for thousands
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format a score with + or - prefix
 */
export function formatScore(score: number): string {
  if (score > 0) return `+${score}`
  return score.toString()
}

/**
 * Format a date relative to now
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = typeof date === 'number'
    ? new Date(date * 1000) // Unix timestamp in seconds
    : typeof date === 'string'
      ? new Date(date)
      : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

/**
 * Calculate percentage with bounds
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.min(100, Math.max(0, (value / total) * 100))
}

/**
 * Get quality tier from score
 */
export function getQualityTier(score: number): 'exceptional' | 'strong' | 'moderate' | 'weak' | 'poor' {
  if (score >= 8) return 'exceptional'
  if (score >= 6) return 'strong'
  if (score >= 4) return 'moderate'
  if (score >= 2) return 'weak'
  return 'poor'
}

/**
 * Get tier color class
 */
export function getTierColorClass(tier: string): string {
  switch (tier) {
    case 'exceptional': return 'text-emerald-400'
    case 'strong': return 'text-green-400'
    case 'moderate': return 'text-yellow-400'
    case 'weak': return 'text-orange-400'
    case 'poor': return 'text-red-400'
    default: return 'text-zinc-400'
  }
}

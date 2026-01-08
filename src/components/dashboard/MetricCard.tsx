"use client"

import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { cardVariants } from "@/lib/animations"

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  delay?: number
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  delay = 0
}: MetricCardProps) {
  const iconStyles = {
    default: 'text-muted-foreground bg-secondary border-border/50',
    primary: 'text-primary bg-primary/10 border-primary/20',
    success: 'text-success bg-success/10 border-success/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    danger: 'text-danger bg-danger/10 border-danger/20',
  }

  const valueStyles = {
    default: 'text-foreground',
    primary: 'text-gradient',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      transition={{ delay }}
    >
      <Card variant="premium" className="h-full overflow-hidden group">
        <CardContent className="p-6 relative">
          {/* Subtle gradient overlay on hover */}
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            variant === 'primary' && "bg-gradient-to-br from-primary/5 to-transparent",
            variant === 'success' && "bg-gradient-to-br from-success/5 to-transparent",
            variant === 'warning' && "bg-gradient-to-br from-warning/5 to-transparent",
            variant === 'danger' && "bg-gradient-to-br from-danger/5 to-transparent",
          )} />

          <div className="flex items-start justify-between relative">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
                {title}
              </p>
              <p className={cn(
                "text-4xl font-heading font-bold tracking-tight",
                valueStyles[variant]
              )}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              {subtitle && (
                <p className="text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
              {trend && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded",
                    trend.positive
                      ? "text-success bg-success/10"
                      : "text-danger bg-danger/10"
                  )}>
                    {trend.positive ? "+" : ""}{trend.value}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {trend.label}
                  </span>
                </div>
              )}
            </div>
            <div className={cn(
              "p-3 rounded-xl border transition-transform duration-300 group-hover:scale-110",
              iconStyles[variant]
            )}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

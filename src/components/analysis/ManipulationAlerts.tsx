"use client"

import { motion } from "framer-motion"
import {
  AlertTriangle,
  Bot,
  Users,
  BarChart3,
  MessageSquare,
  Shield,
  ShieldAlert,
  ShieldX,
  User
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ManipulationAlert, ManipulationSeverity, ManipulationType } from "@/types/analysis"

interface ManipulationAlertsProps {
  alerts: ManipulationAlert[]
  className?: string
}

function getTypeIcon(type: ManipulationType) {
  switch (type) {
    case 'coordinated':
      return <Users className="w-4 h-4" />
    case 'statistical_anomaly':
      return <BarChart3 className="w-4 h-4" />
    case 'talking_points':
      return <MessageSquare className="w-4 h-4" />
    case 'gish_gallop':
      return <MessageSquare className="w-4 h-4" />
    case 'bot_behavior':
      return <Bot className="w-4 h-4" />
    case 'brigading':
      return <Users className="w-4 h-4" />
    case 'astroturfing':
      return <Bot className="w-4 h-4" />
    default:
      return <AlertTriangle className="w-4 h-4" />
  }
}

function getTypeLabel(type: ManipulationType): string {
  const labels: Record<ManipulationType, string> = {
    coordinated: 'Coordinated Behavior',
    statistical_anomaly: 'Statistical Anomaly',
    talking_points: 'Repeated Talking Points',
    gish_gallop: 'Gish Gallop',
    bot_behavior: 'Bot-like Behavior',
    brigading: 'Brigading',
    astroturfing: 'Astroturfing'
  }
  return labels[type] || type
}

function getSeverityColor(severity: ManipulationSeverity): string {
  switch (severity) {
    case 'high':
      return 'text-danger'
    case 'medium':
      return 'text-warning'
    case 'low':
      return 'text-info'
    default:
      return 'text-muted-foreground'
  }
}

function getSeverityBg(severity: ManipulationSeverity): string {
  switch (severity) {
    case 'high':
      return 'bg-danger/10 border-danger/30'
    case 'medium':
      return 'bg-warning/10 border-warning/30'
    case 'low':
      return 'bg-info/10 border-info/30'
    default:
      return 'bg-muted/50 border-border'
  }
}

function getSeverityIcon(severity: ManipulationSeverity) {
  switch (severity) {
    case 'high':
      return <ShieldX className="w-5 h-5 text-danger" />
    case 'medium':
      return <ShieldAlert className="w-5 h-5 text-warning" />
    case 'low':
      return <Shield className="w-5 h-5 text-info" />
    default:
      return <Shield className="w-5 h-5 text-muted-foreground" />
  }
}

function AlertCard({ alert, index }: { alert: ManipulationAlert; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className={cn(
        "p-4 rounded-lg border",
        getSeverityBg(alert.severity)
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {getSeverityIcon(alert.severity)}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getTypeIcon(alert.type)}
              <span className="font-medium text-sm">
                {getTypeLabel(alert.type)}
              </span>
            </div>
            <Badge
              variant={
                alert.severity === 'high' ? 'danger' :
                alert.severity === 'medium' ? 'warning' : 'info'
              }
            >
              {alert.severity}
            </Badge>
          </div>

          <p className="text-sm text-foreground">
            {alert.description}
          </p>

          {alert.involvedUsers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Involved:</span>
              {alert.involvedUsers.slice(0, 5).map((user) => (
                <span
                  key={user}
                  className="text-xs px-2 py-0.5 rounded bg-background/50 text-muted-foreground"
                >
                  u/{user}
                </span>
              ))}
              {alert.involvedUsers.length > 5 && (
                <span className="text-xs text-muted-foreground">
                  +{alert.involvedUsers.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function ManipulationAlerts({ alerts, className }: ManipulationAlertsProps) {
  // Group alerts by severity
  const highAlerts = alerts.filter(a => a.severity === 'high')
  const mediumAlerts = alerts.filter(a => a.severity === 'medium')
  const lowAlerts = alerts.filter(a => a.severity === 'low')

  const overallRisk = highAlerts.length > 0 ? 'high' :
                      mediumAlerts.length > 0 ? 'medium' : 'low'

  if (alerts.length === 0) {
    return (
      <Card variant="premium" className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-success" />
            Manipulation Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Shield className="w-12 h-12 mx-auto mb-4 text-success opacity-70" />
          <p className="text-success font-medium">No manipulation detected</p>
          <p className="text-xs text-muted-foreground mt-1">
            This thread appears to have organic participation
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <Card variant="premium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className={cn(
                "w-5 h-5",
                overallRisk === 'high' ? 'text-danger' :
                overallRisk === 'medium' ? 'text-warning' : 'text-info'
              )} />
              Manipulation Detection
            </CardTitle>
            <Badge
              variant={
                overallRisk === 'high' ? 'danger' :
                overallRisk === 'medium' ? 'warning' : 'info'
              }
            >
              {overallRisk} risk
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {alerts.length} potential issue{alerts.length !== 1 ? 's' : ''} detected
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Risk Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-danger/10 border border-danger/20">
              <p className="text-lg font-bold text-danger">{highAlerts.length}</p>
              <p className="text-xs text-muted-foreground">High</p>
            </div>
            <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-lg font-bold text-warning">{mediumAlerts.length}</p>
              <p className="text-xs text-muted-foreground">Medium</p>
            </div>
            <div className="p-2 rounded-lg bg-info/10 border border-info/20">
              <p className="text-lg font-bold text-info">{lowAlerts.length}</p>
              <p className="text-xs text-muted-foreground">Low</p>
            </div>
          </div>

          {/* Alerts List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} index={i} />
            ))}
          </div>

          {/* Disclaimer */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Note:</span> These are automated detections
              and may include false positives. Use judgment when interpreting results.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

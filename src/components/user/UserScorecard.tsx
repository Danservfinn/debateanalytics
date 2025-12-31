"use client"

import { motion } from "framer-motion"
import { Award, AlertTriangle, Target, TrendingUp, MessageSquare, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { cardVariants } from "@/lib/animations"
import { getQualityTier, getTierColorClass } from "@/lib/utils"
import type { UserMetrics } from "@/types/debate"

interface UserScorecardProps {
  user: UserMetrics
}

export function UserScorecard({ user }: UserScorecardProps) {
  const tier = getQualityTier(user.qualityScore)
  const tierColor = getTierColorClass(tier)

  const stats = [
    {
      label: "Quality Score",
      value: `${user.qualityScore}/10`,
      icon: Target,
      color: tierColor
    },
    {
      label: "Strong Arguments",
      value: user.argumentMetrics.strongArguments,
      icon: Award,
      color: "text-success"
    },
    {
      label: "Weak Arguments",
      value: user.argumentMetrics.weakArguments,
      icon: AlertTriangle,
      color: "text-danger"
    },
    {
      label: "Total Comments",
      value: user.totalComments,
      icon: MessageSquare,
      color: "text-info"
    },
    {
      label: "Avg Karma",
      value: user.avgKarma.toFixed(1),
      icon: TrendingUp,
      color: user.avgKarma >= 5 ? "text-success" : "text-muted-foreground"
    },
    {
      label: "Fallacy Rate",
      value: `${user.fallacyProfile.fallacyRate}%`,
      icon: AlertTriangle,
      color: user.fallacyProfile.fallacyRate <= 5 ? "text-success" : "text-warning"
    },
  ]

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <Card variant="featured" className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-primary">
              <AvatarFallback className="text-xl font-bold bg-primary/20 text-primary">
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">u/{user.username}</CardTitle>
                {user.rank && (
                  <Badge variant="default">
                    #{user.rank}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={
                    tier === 'exceptional' || tier === 'strong' ? 'success' :
                    tier === 'moderate' ? 'warning' : 'danger'
                  }
                >
                  {tier.charAt(0).toUpperCase() + tier.slice(1)} Debater
                </Badge>
                <span className="text-sm text-muted-foreground capitalize">
                  {user.rhetoricalStyle} style
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Quality progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Quality</span>
              <span className={cn("font-medium", tierColor)}>
                {user.qualityScore}/10
              </span>
            </div>
            <Progress
              value={user.qualityScore * 10}
              className="h-2"
              indicatorClassName={cn(
                tier === 'exceptional' || tier === 'strong' ? 'bg-success' :
                tier === 'moderate' ? 'bg-warning' : 'bg-danger'
              )}
            />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-3 rounded-lg bg-secondary/50"
              >
                <stat.icon className={cn("w-4 h-4 mx-auto mb-1", stat.color)} />
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Top subreddits */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Top Subreddits</p>
            <div className="flex flex-wrap gap-2">
              {user.topSubreddits.slice(0, 5).map((sub) => (
                <Badge key={sub.subreddit} variant="neutral" className="text-xs">
                  r/{sub.subreddit} ({sub.commentCount})
                </Badge>
              ))}
            </div>
          </div>

          {/* Activity pattern */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Most active: {user.activityPatterns.mostActiveDay}s at {user.activityPatterns.mostActiveHour}:00
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

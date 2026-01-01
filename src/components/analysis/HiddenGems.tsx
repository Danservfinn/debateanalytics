"use client"

import { motion } from "framer-motion"
import {
  Gem,
  User,
  ThumbsUp,
  Star,
  TrendingDown,
  ExternalLink
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { HiddenGem } from "@/types/analysis"

interface HiddenGemsProps {
  gems: HiddenGem[]
  className?: string
}

function GemCard({ gem, index }: { gem: HiddenGem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative"
    >
      {/* Gem rank indicator */}
      <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg">
        {index + 1}
      </div>

      <div className="p-4 pl-6 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 hover:border-primary/40 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">u/{gem.author}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ThumbsUp className="w-3 h-3" />
              <span>{gem.karma}</span>
            </div>
            <Badge variant="success" className="text-xs">
              <Star className="w-3 h-3 mr-1" />
              {gem.qualityScore.toFixed(1)}
            </Badge>
          </div>
        </div>

        {/* Comment text */}
        <p className="text-sm text-foreground leading-relaxed mb-3 line-clamp-4">
          &ldquo;{gem.text}&rdquo;
        </p>

        {/* Why underrated */}
        <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/20">
          <TrendingDown className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="text-warning font-medium">Why underrated:</span>{" "}
            {gem.reasonUnderrated}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export function HiddenGems({ gems, className }: HiddenGemsProps) {
  if (gems.length === 0) {
    return (
      <Card variant="premium" className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gem className="w-5 h-5 text-primary" />
            Hidden Gems
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Gem className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hidden gems detected</p>
          <p className="text-xs mt-1">All quality comments received appropriate recognition</p>
        </CardContent>
      </Card>
    )
  }

  // Calculate stats
  const avgKarma = gems.reduce((acc, g) => acc + g.karma, 0) / gems.length
  const avgQuality = gems.reduce((acc, g) => acc + g.qualityScore, 0) / gems.length
  const karmaDelta = avgQuality * 10 - avgKarma // Approximate "deserved" karma

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
              <Gem className="w-5 h-5 text-primary" />
              Hidden Gems
            </CardTitle>
            <Badge variant="default" className="text-xs">
              {gems.length} found
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            High-quality comments that flew under the radar
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl font-bold text-foreground">{avgKarma.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Avg Karma</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-success/10">
              <p className="text-xl font-bold text-success">{avgQuality.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Avg Quality</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-warning/10">
              <p className="text-xl font-bold text-warning">+{karmaDelta.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Deserved More</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-medium">What are hidden gems?</span>{" "}
              These are comments with high argument quality scores but low karma,
              often due to timing, thread position, or going against the crowd.
              They represent signal lost in noise.
            </p>
          </div>

          {/* Gems List */}
          <div className="space-y-6">
            {gems.map((gem, i) => (
              <GemCard key={gem.commentId} gem={gem} index={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { MessageSquare, ArrowUp, AlertTriangle, Award } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { cardVariants } from "@/lib/animations"
import type { ThreadAnalysis } from "@/types/debate"

interface ThreadCardProps {
  thread: ThreadAnalysis
  index?: number
}

export function ThreadCard({ thread, index = 0 }: ThreadCardProps) {
  const { metadata, statistics } = thread

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      transition={{ delay: index * 0.1 }}
    >
      <Link href={`/thread/${thread.id}`}>
        <Card variant="premium" className="h-full cursor-pointer group">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="neutral" className="text-xs">
                r/{metadata.subreddit}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUp className="w-3 h-3" />
                {metadata.score}
              </div>
            </div>
            <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
              {metadata.title}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-success">
                  <Award className="w-3 h-3" />
                  <span className="text-sm font-semibold">{statistics.strongArguments}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Strong</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-danger">
                  <span className="text-sm font-semibold">{statistics.weakArguments}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Weak</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-warning">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-sm font-semibold">{statistics.totalFallacies}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Fallacies</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                {metadata.numComments} comments
              </div>
              <span className="text-xs text-muted-foreground">
                by u/{metadata.author}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

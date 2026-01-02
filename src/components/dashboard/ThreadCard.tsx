"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { MessageSquare, ArrowUp, AlertTriangle, Award, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { cardVariants } from "@/lib/animations"
import type { ThreadAnalysis, ThreadAnalysisResult } from "@/types/debate"

interface ThreadCardProps {
  thread: ThreadAnalysis | ThreadAnalysisResult
  index?: number
}

// Type guard to check if thread is ThreadAnalysisResult
function isThreadAnalysisResult(thread: ThreadAnalysis | ThreadAnalysisResult): thread is ThreadAnalysisResult {
  return 'threadId' in thread && 'verdict' in thread
}

export function ThreadCard({ thread, index = 0 }: ThreadCardProps) {
  // Normalize data based on type
  const isResult = isThreadAnalysisResult(thread)

  const threadId = isResult ? thread.threadId : thread.metadata?.id || thread.id
  const subreddit = isResult ? thread.subreddit : thread.metadata?.subreddit
  const title = isResult ? thread.title : thread.metadata?.title
  const author = isResult ? thread.author : thread.metadata?.author
  const commentCount = isResult ? thread.commentCount : thread.metadata?.numComments
  const score = isResult ? Math.round(thread.verdict?.overallScore * 10 || 0) : thread.metadata?.score

  // Stats - derive from debates for ThreadAnalysisResult
  const strongArgs = isResult
    ? thread.debates?.reduce((sum, d) => sum + d.replies.filter(r => r.qualityScore >= 7).length, 0) || 0
    : thread.statistics?.strongArguments || 0
  const weakArgs = isResult
    ? thread.debates?.reduce((sum, d) => sum + d.replies.filter(r => r.qualityScore < 4).length, 0) || 0
    : thread.statistics?.weakArguments || 0
  const fallacies = isResult
    ? thread.fallacies?.length || 0
    : thread.statistics?.totalFallacies || 0

  // Build URL with proper encoding
  const threadUrl = isResult && thread.url
    ? `/thread/${subreddit}-${threadId.split('-').pop()}?url=${encodeURIComponent(thread.url)}`
    : `/thread/${threadId}`

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
      transition={{ delay: index * 0.1 }}
    >
      <Link href={threadUrl}>
        <Card variant="premium" className="h-full cursor-pointer group">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="neutral" className="text-xs">
                r/{subreddit}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {isResult ? (
                  <>
                    <TrendingUp className="w-3 h-3" />
                    {score}/10
                  </>
                ) : (
                  <>
                    <ArrowUp className="w-3 h-3" />
                    {score}
                  </>
                )}
              </div>
            </div>
            <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-success">
                  <Award className="w-3 h-3" />
                  <span className="text-sm font-semibold">{strongArgs}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Strong</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-danger">
                  <span className="text-sm font-semibold">{weakArgs}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Weak</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-warning">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-sm font-semibold">{fallacies}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Fallacies</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                {commentCount} comments
              </div>
              <span className="text-xs text-muted-foreground">
                by u/{author}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Trophy, Medal, Award, TrendingUp, ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { getLeaderboard } from "@/lib/data"
import { staggerContainer, fadeInUp } from "@/lib/animations"
import { cn } from "@/lib/utils"
import type { UserMetrics } from "@/types/debate"

export default function LeaderboardPage() {
  const [users, setUsers] = useState<UserMetrics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'score' | 'arguments' | 'fallacies'>('score')

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      const data = await getLeaderboard(20, sortBy)
      setUsers(data)
      setIsLoading(false)
    }
    loadData()
  }, [sortBy])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-400" />
      case 2: return <Medal className="w-5 h-5 text-gray-300" />
      case 3: return <Medal className="w-5 h-5 text-amber-600" />
      default: return <span className="text-muted-foreground font-mono">#{rank}</span>
    }
  }

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-400/10 border-yellow-400/30'
      case 2: return 'bg-gray-300/10 border-gray-300/30'
      case 3: return 'bg-amber-600/10 border-amber-600/30'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen">
      <FloatingShapes />
      <Navbar />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="text-center py-8"
        >
          <h1 className="text-3xl md:text-4xl font-heading font-bold flex items-center justify-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Top debaters ranked by argument quality and engagement
          </p>
        </motion.section>

        {/* Sort controls */}
        <div className="flex justify-center gap-2">
          <Button
            variant={sortBy === 'score' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('score')}
          >
            <Award className="w-4 h-4 mr-1" />
            Quality Score
          </Button>
          <Button
            variant={sortBy === 'arguments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('arguments')}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Net Arguments
          </Button>
          <Button
            variant={sortBy === 'fallacies' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('fallacies')}
          >
            <ArrowUpDown className="w-4 h-4 mr-1" />
            Lowest Fallacies
          </Button>
        </div>

        {/* Leaderboard */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto space-y-3"
        >
          {isLoading ? (
            <Card variant="premium" className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-4">Loading leaderboard...</p>
            </Card>
          ) : users.length > 0 ? (
            users.map((user, index) => (
              <motion.div
                key={user.username}
                variants={fadeInUp}
                whileHover={{ scale: 1.01 }}
              >
                <Link href={`/user/${user.username}`}>
                  <Card
                    variant="premium"
                    className={cn(
                      "transition-all cursor-pointer hover:border-primary/30",
                      getRankBg(index + 1)
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className="w-12 h-12 flex items-center justify-center">
                          {getRankIcon(index + 1)}
                        </div>

                        {/* Avatar */}
                        <Avatar className="w-12 h-12 border-2 border-border">
                          <AvatarFallback className="text-sm font-bold bg-primary/20 text-primary">
                            {user.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">u/{user.username}</p>
                            <Badge variant="neutral" className="text-xs capitalize">
                              {user.rhetoricalStyle}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {user.totalComments} comments
                            </span>
                            <span className="text-xs text-success">
                              {user.argumentMetrics.strongArguments} strong
                            </span>
                            <span className="text-xs text-danger">
                              {user.argumentMetrics.weakArguments} weak
                            </span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {user.qualityScore.toFixed(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">score</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <Progress
                          value={user.qualityScore * 10}
                          className="h-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))
          ) : (
            <Card variant="premium" className="p-8 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mt-4">No debaters ranked yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Search for Reddit users to build the leaderboard!
              </p>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  )
}

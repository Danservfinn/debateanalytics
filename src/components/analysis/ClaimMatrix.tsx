"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  Link2,
  User,
  ChevronDown,
  ChevronUp,
  Search
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Claim } from "@/types/analysis"

interface ClaimMatrixProps {
  claims: Claim[]
  className?: string
}

function getVerificationIcon(status: string) {
  switch (status) {
    case 'verified':
      return <CheckCircle className="w-4 h-4 text-success" />
    case 'disputed':
      return <AlertCircle className="w-4 h-4 text-warning" />
    case 'false':
      return <XCircle className="w-4 h-4 text-danger" />
    default:
      return <HelpCircle className="w-4 h-4 text-muted-foreground" />
  }
}

function getVerificationBadge(status: string) {
  switch (status) {
    case 'verified':
      return <Badge variant="success">Verified</Badge>
    case 'disputed':
      return <Badge variant="warning">Disputed</Badge>
    case 'false':
      return <Badge variant="danger">False</Badge>
    default:
      return <Badge variant="neutral">Unverified</Badge>
  }
}

function ClaimCard({ claim, index }: { claim: Claim; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "p-4 rounded-lg border transition-all cursor-pointer",
        "bg-card/50 hover:bg-card/80 border-border/50 hover:border-primary/30"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {getVerificationIcon(claim.verificationStatus)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className={cn(
              "text-sm font-medium text-foreground",
              !expanded && "line-clamp-2"
            )}>
              &ldquo;{claim.text}&rdquo;
            </p>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <User className="w-3 h-3" />
              <span>u/{claim.author}</span>
            </div>
            {getVerificationBadge(claim.verificationStatus)}
            {claim.sourceCited && (
              <Badge variant="info" className="text-xs">
                <Link2 className="w-3 h-3 mr-1" />
                Sourced
              </Badge>
            )}
            <span className="text-muted-foreground">
              Relevance: {Math.round(claim.relevanceScore * 100)}%
            </span>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 pt-3 border-t border-border/50 space-y-2"
              >
                {claim.sourceUrl && (
                  <div className="flex items-center gap-2 text-xs">
                    <Link2 className="w-3 h-3 text-info" />
                    <a
                      href={claim.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {claim.sourceUrl}
                    </a>
                  </div>
                )}
                {claim.refutedBy.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="text-warning">Refuted by:</span>{" "}
                    {claim.refutedBy.length} other claim(s)
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

export function ClaimMatrix({ claims, className }: ClaimMatrixProps) {
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  // Calculate stats
  const stats = {
    total: claims.length,
    verified: claims.filter(c => c.verificationStatus === 'verified').length,
    disputed: claims.filter(c => c.verificationStatus === 'disputed').length,
    false: claims.filter(c => c.verificationStatus === 'false').length,
    unverified: claims.filter(c => c.verificationStatus === 'unverified').length,
    sourced: claims.filter(c => c.sourceCited).length
  }

  // Filter claims
  const filteredClaims = claims.filter(claim => {
    const matchesFilter = filter === "all" ||
      (filter === "sourced" ? claim.sourceCited : claim.verificationStatus === filter)
    const matchesSearch = search === "" ||
      claim.text.toLowerCase().includes(search.toLowerCase()) ||
      claim.author.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Claim Analysis
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-success/10">
              <p className="text-2xl font-bold text-success">{stats.verified}</p>
              <p className="text-xs text-muted-foreground">Verified</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-warning/10">
              <p className="text-2xl font-bold text-warning">{stats.disputed}</p>
              <p className="text-xs text-muted-foreground">Disputed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-danger/10">
              <p className="text-2xl font-bold text-danger">{stats.false}</p>
              <p className="text-xs text-muted-foreground">False</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-muted-foreground">{stats.unverified}</p>
              <p className="text-xs text-muted-foreground">Unverified</p>
            </div>
          </div>

          {/* Source Quality */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Claims with sources</span>
              <span className="font-medium">
                {stats.sourced}/{stats.total} ({Math.round((stats.sourced / stats.total) * 100)}%)
              </span>
            </div>
            <Progress value={(stats.sourced / stats.total) * 100} className="h-2" />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All", count: stats.total },
              { value: "verified", label: "Verified", count: stats.verified },
              { value: "disputed", label: "Disputed", count: stats.disputed },
              { value: "unverified", label: "Unverified", count: stats.unverified },
              { value: "sourced", label: "Sourced", count: stats.sourced }
            ].map(({ value, label, count }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  filter === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search claims..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Claims List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredClaims.length > 0 ? (
              filteredClaims.map((claim, i) => (
                <ClaimCard key={claim.id} claim={claim} index={i} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No claims match your filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

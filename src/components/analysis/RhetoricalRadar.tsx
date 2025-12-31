"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts"
import {
  Brain,
  Heart,
  BookOpen,
  Award,
  Handshake,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getStyleIcon, calculateHonestyTier } from "@/types/analysis"
import type { RhetoricalProfile } from "@/types/analysis"

interface RhetoricalRadarProps {
  profiles: RhetoricalProfile[]
  className?: string
}

interface ProfileCardProps {
  profile: RhetoricalProfile
  isSelected: boolean
  onClick: () => void
}

function ProfileCard({ profile, isSelected, onClick }: ProfileCardProps) {
  const honestyTier = calculateHonestyTier(profile.intellectualHonesty)

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-lg border text-left transition-all",
        isSelected
          ? "bg-primary/10 border-primary"
          : "bg-card/50 border-border/50 hover:border-primary/30"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStyleIcon(profile.style)}</span>
          <span className="font-medium text-sm">u/{profile.username}</span>
        </div>
        <Badge
          variant={profile.intellectualHonesty >= 6 ? "success" : profile.intellectualHonesty >= 4 ? "warning" : "danger"}
          className="text-xs"
        >
          {profile.intellectualHonesty.toFixed(1)}
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{profile.commentCount} comments</span>
        <span>•</span>
        <span className="capitalize">{profile.style}</span>
      </div>
    </button>
  )
}

export function RhetoricalRadar({ profiles, className }: RhetoricalRadarProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Sort profiles by intellectual honesty
  const sortedProfiles = [...profiles].sort(
    (a, b) => b.intellectualHonesty - a.intellectualHonesty
  )

  const selectedProfile = sortedProfiles[selectedIndex]

  // Transform profile data for radar chart
  const radarData = selectedProfile ? [
    { dimension: "Logic", value: selectedProfile.logicScore, fullMark: 100 },
    { dimension: "Emotion", value: selectedProfile.emotionScore, fullMark: 100 },
    { dimension: "Evidence", value: selectedProfile.evidenceScore, fullMark: 100 },
    { dimension: "Authority", value: selectedProfile.authorityScore, fullMark: 100 },
    { dimension: "Concession", value: selectedProfile.concessionScore, fullMark: 100 }
  ] : []

  const honestyTier = selectedProfile
    ? calculateHonestyTier(selectedProfile.intellectualHonesty)
    : null

  const handlePrev = () => {
    setSelectedIndex((prev) =>
      prev === 0 ? sortedProfiles.length - 1 : prev - 1
    )
  }

  const handleNext = () => {
    setSelectedIndex((prev) =>
      prev === sortedProfiles.length - 1 ? 0 : prev + 1
    )
  }

  if (profiles.length === 0) {
    return (
      <Card variant="premium" className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Rhetorical Profiles
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No participant profiles available</p>
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
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Rhetorical Profiles
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Profile Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {selectedIndex + 1} of {sortedProfiles.length}
              </p>
            </div>
            <button
              onClick={handleNext}
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Selected Profile Header */}
          {selectedProfile && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">{getStyleIcon(selectedProfile.style)}</span>
                <h3 className="text-xl font-bold">u/{selectedProfile.username}</h3>
              </div>
              <p className="text-sm text-muted-foreground capitalize">
                {selectedProfile.style} debater • {selectedProfile.commentCount} comments
              </p>
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" style={{ color: honestyTier?.color }} />
                <span
                  className="font-medium"
                  style={{ color: honestyTier?.color }}
                >
                  {honestyTier?.label} ({selectedProfile.intellectualHonesty.toFixed(1)}/10)
                </span>
              </div>
            </div>
          )}

          {/* Radar Chart */}
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                />
                <Radar
                  name={selectedProfile?.username || ""}
                  dataKey="value"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fafafa'
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Debate Behavior Stats */}
          {selectedProfile && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-success/10">
                <p className="text-lg font-bold text-success">{selectedProfile.steelmans}</p>
                <p className="text-xs text-muted-foreground">Steelmans</p>
              </div>
              <div className="p-2 rounded-lg bg-danger/10">
                <p className="text-lg font-bold text-danger">{selectedProfile.strawmans}</p>
                <p className="text-xs text-muted-foreground">Strawmans</p>
              </div>
              <div className="p-2 rounded-lg bg-info/10">
                <p className="text-lg font-bold text-info">{selectedProfile.concessions}</p>
                <p className="text-xs text-muted-foreground">Concessions</p>
              </div>
              <div className="p-2 rounded-lg bg-warning/10">
                <p className="text-lg font-bold text-warning">{selectedProfile.dodges}</p>
                <p className="text-xs text-muted-foreground">Dodges</p>
              </div>
            </div>
          )}

          {/* Profile List */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              All Participants (ranked by honesty)
            </p>
            {sortedProfiles.map((profile, i) => (
              <ProfileCard
                key={profile.username}
                profile={profile}
                isSelected={i === selectedIndex}
                onClick={() => setSelectedIndex(i)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

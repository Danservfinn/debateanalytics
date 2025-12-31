"use client"

import { motion } from "framer-motion"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SkillDimension } from "@/types/debate"

interface SkillRadarProps {
  data: SkillDimension[]
  username: string
}

export function SkillRadar({ data, username }: SkillRadarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card variant="premium">
        <CardHeader>
          <CardTitle className="text-lg">Skill Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                <PolarGrid
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="3 3"
                />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                />
                <Radar
                  name={username}
                  dataKey="value"
                  stroke="#ea580c"
                  fill="#ea580c"
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
        </CardContent>
      </Card>
    </motion.div>
  )
}

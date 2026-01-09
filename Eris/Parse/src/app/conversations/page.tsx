/**
 * Conversations Landing Page
 * Reddit-inspired tab navigation for debates and discussions
 */

'use client'

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, TrendingUp, Clock, Flame, Plus } from "lucide-react"

type TabType = "trending" | "recent" | "my-conversations"

interface Conversation {
  id: string
  title: string
  claim: string
  participants: number
  messages: number
  lastActive: string
  truthScore?: number
  tags: string[]
}

// Conversations will be loaded from the database
// No mock data - feature coming soon
const conversations: Conversation[] = []

export default function ConversationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("trending")

  const tabs = [
    { id: "trending" as TabType, label: "Trending", icon: TrendingUp },
    { id: "recent" as TabType, label: "Recent", icon: Clock },
    { id: "my-conversations" as TabType, label: "My Conversations", icon: MessageSquare }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2">
                Conversations
              </h1>
              <p className="text-muted-foreground text-lg">
                Critical debates and discussions with truth-scored arguments
              </p>
            </div>
            <Link href="/conversations/new">
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Start Conversation
              </Button>
            </Link>
          </div>

          {/* Reddit-style Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-800">
            <div className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 border-b-2 transition-colors
                      ${isActive
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-muted-foreground hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <Link key={conversation.id} href={`/conversations/${conversation.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Vote/Truth Score Column */}
                    <div className="flex flex-col items-center gap-1 min-w-[60px]">
                      <div className={`
                        text-2xl font-bold
                        ${conversation.truthScore && conversation.truthScore >= 70 ? 'text-green-600' :
                          conversation.truthScore && conversation.truthScore >= 50 ? 'text-yellow-600' :
                          'text-red-600'}
                      `}>
                        {conversation.truthScore || '?'}
                      </div>
                      <div className="text-xs text-muted-foreground">truth</div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1 hover:text-blue-600 dark:hover:text-blue-400">
                            {conversation.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {conversation.claim}
                          </p>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                        <div className="flex gap-1">
                          {conversation.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          <span>{conversation.messages} messages</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flame className="h-4 w-4" />
                          <span>{conversation.participants} participants</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{conversation.lastActive}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Empty State - show when no conversations */}
        {conversations.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Conversations Coming Soon</h3>
              <p className="text-muted-foreground mb-4">
                Critical debates and discussions with truth-scored arguments will be available soon.
                In the meantime, analyze articles to see our truth-scoring system in action.
              </p>
              <Link href="/analyze">
                <Button>Analyze an Article</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

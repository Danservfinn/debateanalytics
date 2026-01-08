/**
 * Start New Conversation Page
 * Form to create a new critical debate
 */

'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NewConversationPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [claim, setClaim] = useState("")
  const [initialArgument, setInitialArgument] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput])
      setTagInput("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Create conversation via API
    router.push(`/conversations`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link href="/conversations">
            <Button variant="ghost" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Conversations
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Start a New Conversation
          </h1>
          <p className="text-muted-foreground">
            Create a critical debate around a claim or proposition
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation Details</CardTitle>
            <CardDescription>
              Provide the topic and initial argument to start the debate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Title
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Climate Policy Effectiveness"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A short, descriptive title for the conversation
                </p>
              </div>

              {/* Claim */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Central Claim or Proposition
                </label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-transparent resize-none"
                  placeholder="e.g., Carbon taxes are the most effective way to reduce emissions"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The main claim or proposition that will be debated
                </p>
              </div>

              {/* Initial Argument */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Initial Argument (Optional)
                </label>
                <textarea
                  className="w-full min-h-[150px] px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-transparent resize-none"
                  placeholder="Provide your initial argument supporting or opposing the claim..."
                  value={initialArgument}
                  onChange={(e) => setInitialArgument(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Start the debate with your opening argument
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="text"
                    placeholder="Add a tag (e.g., economics, policy)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <Button type="button" onClick={handleAddTag} variant="outline">
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Add tags to help others discover your conversation
                </p>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  Create Conversation
                </Button>
                <Link href="/conversations" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Link2, ArrowRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThreadSearch() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    // Validate Reddit URL
    const redditPattern = /(?:https?:\/\/)?(?:www\.)?(?:old\.)?(?:new\.)?reddit\.com\/r\/\w+\/comments\/\w+/i
    if (!redditPattern.test(trimmedUrl)) {
      setError("Please enter a valid Reddit thread URL")
      return
    }

    setError(null)
    setIsLoading(true)

    // Extract thread ID from URL for routing
    const match = trimmedUrl.match(/\/r\/(\w+)\/comments\/(\w+)/)
    if (match) {
      const [, subreddit, threadId] = match
      router.push(`/thread/${subreddit}-${threadId}?url=${encodeURIComponent(trimmedUrl)}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="relative">
        {/* Search label */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-heading font-semibold text-foreground">
            Analyze Reddit Thread
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Paste a Reddit thread URL to analyze the debate
          </p>
        </div>

        {/* URL input */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="url"
                placeholder="https://reddit.com/r/changemyview/comments/..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError(null)
                }}
                onKeyDown={handleKeyDown}
                className={cn(
                  "pl-12 pr-4 h-14 text-base bg-card border-2 rounded-xl",
                  error ? "border-danger" : "border-border focus:border-primary"
                )}
              />
            </div>
            <Button
              size="lg"
              className="h-14 px-6 rounded-xl"
              onClick={handleAnalyze}
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Analyze
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-danger mt-2 text-center"
          >
            {error}
          </motion.p>
        )}

        {/* Example URLs */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: "r/changemyview", url: "https://reddit.com/r/changemyview/comments/1pzzzih" },
              { label: "r/raleigh", url: "https://reddit.com/r/raleigh/comments/1nou8kr" },
            ].map((example) => (
              <button
                key={example.url}
                onClick={() => setUrl(example.url)}
                className="px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

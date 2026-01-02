"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Link2, ArrowRight, Loader2, FileJson, Info, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type InputMode = "url" | "json"

export function ThreadSearch() {
  const router = useRouter()
  const [mode, setMode] = useState<InputMode>("url")
  const [url, setUrl] = useState("")
  const [jsonData, setJsonData] = useState("")
  const [jsonUrl, setJsonUrl] = useState("") // Original thread URL for JSON mode
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const handleAnalyzeUrl = async () => {
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

  const handleAnalyzeJson = async () => {
    const trimmedJson = jsonData.trim()
    const trimmedUrl = jsonUrl.trim()

    if (!trimmedJson) {
      setError("Please paste the Reddit JSON data")
      return
    }

    if (!trimmedUrl) {
      setError("Please enter the original thread URL")
      return
    }

    // Validate URL format
    const redditPattern = /(?:https?:\/\/)?(?:www\.)?(?:old\.)?(?:new\.)?reddit\.com\/r\/\w+\/comments\/\w+/i
    if (!redditPattern.test(trimmedUrl)) {
      setError("Please enter a valid Reddit thread URL")
      return
    }

    // Try to parse JSON
    let parsedJson
    try {
      parsedJson = JSON.parse(trimmedJson)
    } catch {
      setError("Invalid JSON format. Make sure you copied the entire JSON response.")
      return
    }

    // Validate it looks like Reddit data
    if (!Array.isArray(parsedJson) || parsedJson.length < 2) {
      setError("This doesn't look like Reddit thread JSON. It should be an array with 2 elements.")
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      // Send to API with manual JSON
      const response = await fetch('/api/analyze-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          threadData: parsedJson
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Analysis failed')
      }

      // Store result in sessionStorage for the thread page to use
      const match = trimmedUrl.match(/\/r\/(\w+)\/comments\/(\w+)/)
      if (match) {
        const [, subreddit, threadId] = match
        const cacheKey = `thread-analysis-${subreddit}-${threadId}`
        // Include raw thread data for potential re-analysis
        const dataWithRaw = {
          ...result.data,
          rawThreadData: parsedJson
        }
        sessionStorage.setItem(cacheKey, JSON.stringify(dataWithRaw))
        router.push(`/thread/${subreddit}-${threadId}?url=${encodeURIComponent(trimmedUrl)}&fromJson=true`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mode === 'url') {
      handleAnalyzeUrl()
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
            {mode === "url"
              ? "Paste a Reddit thread URL to analyze the debate"
              : "Paste Reddit JSON data for production analysis"
            }
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex justify-center gap-2 mb-4">
          <button
            onClick={() => { setMode("url"); setError(null) }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              mode === "url"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Link2 className="w-4 h-4" />
            URL Mode
          </button>
          <button
            onClick={() => { setMode("json"); setError(null) }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              mode === "json"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <FileJson className="w-4 h-4" />
            Paste JSON
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "url" ? (
            <motion.div
              key="url-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
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
                    onClick={handleAnalyzeUrl}
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
            </motion.div>
          ) : (
            <motion.div
              key="json-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Instructions toggle */}
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <Info className="w-4 h-4" />
                How to get Reddit JSON
                {showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {showInstructions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-secondary/50 rounded-xl p-4 text-sm space-y-2">
                      <p className="font-medium text-foreground">Steps to get JSON data:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Go to any Reddit thread in your browser</li>
                        <li>Add <code className="bg-background px-1 rounded">.json</code> to the end of the URL</li>
                        <li>Example: <code className="bg-background px-1 rounded text-xs">reddit.com/r/sub/comments/abc123/.json</code></li>
                        <li>Press <kbd className="bg-background px-1.5 py-0.5 rounded text-xs">Ctrl+A</kbd> to select all, then <kbd className="bg-background px-1.5 py-0.5 rounded text-xs">Ctrl+C</kbd> to copy</li>
                        <li>Paste the JSON below</li>
                      </ol>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        This workaround is needed because Reddit blocks API requests from cloud servers.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thread URL input */}
              <div className="relative">
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="Original thread URL (e.g., reddit.com/r/changemyview/comments/...)"
                  value={jsonUrl}
                  onChange={(e) => {
                    setJsonUrl(e.target.value)
                    setError(null)
                  }}
                  className={cn(
                    "pl-12 pr-4 h-12 text-base bg-card border-2 rounded-xl",
                    error && !jsonUrl.trim() ? "border-danger" : "border-border focus:border-primary"
                  )}
                />
              </div>

              {/* JSON textarea */}
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <textarea
                  placeholder='Paste Reddit JSON here (the data from adding .json to the URL)...'
                  value={jsonData}
                  onChange={(e) => {
                    setJsonData(e.target.value)
                    setError(null)
                  }}
                  className={cn(
                    "relative w-full h-40 p-4 text-sm bg-card border-2 rounded-xl resize-none font-mono",
                    "placeholder:text-muted-foreground focus:outline-none",
                    error && !jsonData.trim() ? "border-danger" : "border-border focus:border-primary"
                  )}
                />
              </div>

              {/* Analyze button */}
              <Button
                size="lg"
                className="w-full h-14 rounded-xl"
                onClick={handleAnalyzeJson}
                disabled={isLoading || !jsonData.trim() || !jsonUrl.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Analyzing... (this may take 2-3 minutes)
                  </>
                ) : (
                  <>
                    <FileJson className="w-5 h-5 mr-2" />
                    Analyze JSON Data
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-danger mt-3 text-center"
          >
            {error}
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}

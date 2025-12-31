"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Clock, ArrowRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getRecentSearches, addRecentSearch, clearRecentSearches } from "@/lib/data"
import { cn } from "@/lib/utils"

export function UserSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  const handleSearch = async (username?: string) => {
    const searchQuery = username || query.trim().replace(/^u\//, '')
    if (!searchQuery) return

    setIsLoading(true)
    addRecentSearch(searchQuery)
    setRecentSearches(getRecentSearches())

    // Navigate to user page
    router.push(`/user/${searchQuery}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleClearRecent = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="relative">
        {/* Search label */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-heading font-semibold text-foreground">
            Analyze Reddit User
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter any Reddit username to analyze their debate patterns
          </p>
        </div>

        {/* Search input */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter username (e.g., wabeka)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                className="pl-12 pr-4 h-14 text-base bg-card border-2 border-border focus:border-primary rounded-xl"
              />
            </div>
            <Button
              size="lg"
              className="h-14 px-6 rounded-xl"
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
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

        {/* Recent searches dropdown */}
        <AnimatePresence>
          {isFocused && recentSearches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 p-2 bg-card border border-border rounded-xl shadow-xl z-50"
            >
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent searches
                </span>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => handleSearch(search)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm",
                      "bg-secondary hover:bg-secondary/80",
                      "text-foreground transition-colors"
                    )}
                  >
                    u/{search}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

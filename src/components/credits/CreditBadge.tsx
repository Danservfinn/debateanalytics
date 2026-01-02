"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Coins, AlertCircle, ChevronDown, Gift, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCredits } from "@/hooks/useCredits"
import { cn } from "@/lib/utils"

export function CreditBadge() {
  const { balance, isLoading, isLow, claimDaily, refresh } = useCredits()
  const [claiming, setClaiming] = useState(false)
  const [claimMessage, setClaimMessage] = useState<string | null>(null)

  async function handleClaimDaily() {
    setClaiming(true)
    setClaimMessage(null)

    const result = await claimDaily()

    if (result.success && result.credited > 0) {
      setClaimMessage(`+${result.credited} credits claimed!`)
    } else {
      setClaimMessage(result.message || "No credits available")
    }

    setClaiming(false)

    // Clear message after 3 seconds
    setTimeout(() => setClaimMessage(null), 3000)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isLow ? "destructive" : "outline"}
          size="sm"
          className={cn(
            "gap-2 relative",
            isLoading && "opacity-70"
          )}
        >
          {isLow && !isLoading && (
            <AlertCircle className="w-4 h-4" />
          )}
          <Coins className="w-4 h-4" />
          <span className="font-medium">
            {isLoading ? "..." : balance?.toLocaleString() ?? "—"}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />

          {/* Pulse animation for low balance */}
          {isLow && !isLoading && (
            <motion.span
              className="absolute inset-0 rounded-md bg-danger/20"
              animate={{ opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Balance display */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-primary" />
            <span className="font-medium">Credit Balance</span>
          </div>
          <div className="text-2xl font-bold">
            {balance?.toLocaleString() ?? "—"}
          </div>
          {balance !== null && (
            <p className="text-xs text-muted-foreground">
              ~{Math.floor(balance / 25)} deep analyses
            </p>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Claim daily credits */}
        <DropdownMenuItem
          onClick={handleClaimDaily}
          disabled={claiming}
          className="cursor-pointer"
        >
          <Gift className="w-4 h-4 mr-2" />
          {claiming ? "Claiming..." : "Claim Daily Credits"}
        </DropdownMenuItem>

        {/* Claim message */}
        <AnimatePresence>
          {claimMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-2"
            >
              <p className={cn(
                "text-xs",
                claimMessage.startsWith("+") ? "text-success" : "text-muted-foreground"
              )}>
                {claimMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <DropdownMenuSeparator />

        {/* Purchase link */}
        <DropdownMenuItem asChild>
          <Link href="/purchase" className="cursor-pointer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Buy More Credits
          </Link>
        </DropdownMenuItem>

        {/* Low balance warning */}
        {isLow && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-2 bg-danger/10 rounded-b-md">
              <p className="text-xs text-danger flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Low balance! Purchase more credits.
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

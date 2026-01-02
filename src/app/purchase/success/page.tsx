"use client"

import { Suspense, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle, Coins, ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import confetti from "canvas-confetti"

function PurchaseSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Celebrate!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#a855f7", "#22c55e", "#3b82f6"],
    })

    // Fetch updated balance
    async function fetchBalance() {
      try {
        const res = await fetch("/api/credits/balance")
        const data = await res.json()
        setBalance(data.balance)
      } catch (error) {
        console.error("Failed to fetch balance:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalance()
  }, [])

  return (
    <div className="min-h-screen">
      <FloatingShapes />
      <Navbar />

      <main className="container mx-auto px-4 py-16 max-w-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          {/* Success icon */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-success/20 mb-6"
            >
              <CheckCircle className="w-12 h-12 text-success" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-heading font-bold mb-2"
            >
              Payment Successful!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground"
            >
              Your credits have been added to your account.
            </motion.p>
          </div>

          {/* Balance card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card variant="premium">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm font-medium">Your New Balance</span>
                    <Sparkles className="w-5 h-5" />
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <Coins className="w-8 h-8 text-primary" />
                    <span className="text-5xl font-bold">
                      {isLoading ? "..." : balance?.toLocaleString() ?? "—"}
                    </span>
                    <span className="text-xl text-muted-foreground">credits</span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    That&apos;s enough for ~{balance ? Math.floor(balance / 25) : 0} deep analyses!
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center space-y-4"
          >
            <Link href="/">
              <Button size="lg" className="gap-2">
                Start Analyzing
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <p className="text-xs text-muted-foreground">
              Session ID: {sessionId?.slice(0, 20)}...
            </p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PurchaseSuccessContent />
    </Suspense>
  )
}

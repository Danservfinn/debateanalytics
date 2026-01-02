"use client"

import { Suspense, useState } from "react"
import { motion } from "framer-motion"
import { Coins, CreditCard, Check, ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { FloatingShapes } from "@/components/layout/FloatingShapes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PURCHASE_TIERS } from "@/types/credits"

function PurchaseContent() {
  const searchParams = useSearchParams()
  const canceled = searchParams.get("canceled")

  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePurchase(tierId: string) {
    setLoading(tierId)
    setError(null)

    try {
      const res = await fetch("/api/payments/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(null)
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError("Failed to start checkout. Please try again.")
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <FloatingShapes />
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-heading font-bold">
              Purchase <span className="text-primary">Credits</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Credits power AI-powered debate analysis. Choose a package that fits your needs.
            </p>
          </div>

          {/* Canceled notice */}
          {canceled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-lg bg-warning/10 border border-warning/20 text-center"
            >
              <p className="text-warning">Payment was canceled. No charges were made.</p>
            </motion.div>
          )}

          {/* Error notice */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-center"
            >
              <p className="text-danger">{error}</p>
            </motion.div>
          )}

          {/* Pricing tiers */}
          <div className="grid md:grid-cols-2 gap-6">
            {PURCHASE_TIERS.map((tier, index) => {
              const totalCredits = tier.credits + tier.bonus
              const pricePerCredit = tier.priceInCents / 100 / totalCredits
              const analyses = Math.floor(totalCredits / 25)

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className={cn(
                      "relative overflow-hidden transition-all hover:border-primary/50",
                      tier.popular && "border-primary ring-2 ring-primary/20"
                    )}
                  >
                    {tier.popular && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-primary">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Most Popular
                        </Badge>
                      </div>
                    )}

                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="capitalize">{tier.id}</span>
                        <span className="text-2xl font-bold">
                          ${(tier.priceInCents / 100).toFixed(2)}
                        </span>
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Credits display */}
                      <div className="text-center py-4 bg-primary/5 rounded-lg">
                        <div className="flex items-center justify-center gap-2">
                          <Coins className="w-6 h-6 text-primary" />
                          <span className="text-3xl font-bold">{totalCredits}</span>
                          <span className="text-muted-foreground">credits</span>
                        </div>
                        {tier.bonus > 0 && (
                          <p className="text-sm text-success mt-1">
                            +{tier.bonus} bonus credits included!
                          </p>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-success" />
                          <span>~{analyses} deep thread analyses</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-success" />
                          <span>${pricePerCredit.toFixed(3)} per credit</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-success" />
                          <span>Never expires</span>
                        </li>
                      </ul>

                      {/* Purchase button */}
                      <Button
                        className="w-full"
                        size="lg"
                        variant={tier.popular ? "default" : "outline"}
                        onClick={() => handlePurchase(tier.id)}
                        disabled={loading !== null}
                      >
                        {loading === tier.id ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Buy Now
                          </span>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {/* Payment info */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p className="flex items-center justify-center gap-2">
              <CreditCard className="w-4 h-4" />
              Secure payment powered by Stripe
            </p>
            <p>
              Questions?{" "}
              <a href="mailto:support@debate-analytics.com" className="text-primary hover:underline">
                Contact support
              </a>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export default function PurchasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PurchaseContent />
    </Suspense>
  )
}

"use client"

import { AlertCircle, Coins, ArrowRight } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CREDIT_COSTS } from "@/lib/credits/costs"
import type { CreditAction } from "@/types/credits"

interface InsufficientCreditsModalProps {
  open: boolean
  onClose: () => void
  action: CreditAction
  required: number
  balance: number
}

export function InsufficientCreditsModal({
  open,
  onClose,
  action,
  required,
  balance,
}: InsufficientCreditsModalProps) {
  const deficit = required - balance

  const actionLabels: Record<CreditAction, string> = {
    deep_analysis: "Deep Thread Analysis",
    quick_analysis: "Quick Analysis",
    user_profile: "User Profile Analysis",
    claim_verify: "Claim Verification",
    arena_battle: "Arena Battle",
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger">
            <AlertCircle className="w-5 h-5" />
            Insufficient Credits
          </DialogTitle>
          <DialogDescription>
            You don&apos;t have enough credits for this action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Balance breakdown */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Required</p>
              <p className="text-xl font-bold text-foreground">{required}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Your Balance</p>
              <p className="text-xl font-bold text-danger">{balance}</p>
            </div>
            <div className="p-3 rounded-lg bg-danger/10">
              <p className="text-xs text-muted-foreground mb-1">Need</p>
              <p className="text-xl font-bold text-danger">+{deficit}</p>
            </div>
          </div>

          {/* Action info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                {actionLabels[action]}
              </span>{" "}
              costs {CREDIT_COSTS[action]} credits
            </p>
          </div>

          {/* Suggested purchase */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Get more credits</p>
                <p className="text-xs text-muted-foreground">
                  Starting at $1 for 100 credits
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Link href="/purchase" className="flex-1">
            <Button className="w-full gap-2">
              Buy Credits
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

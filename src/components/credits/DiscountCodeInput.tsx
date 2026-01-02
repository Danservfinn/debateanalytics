"use client"

import { useState } from "react"
import { Tag, Check, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DiscountCodeInputProps {
  onCodeApplied: (code: string | null, discountPercent: number) => void
  className?: string
}

export function DiscountCodeInput({ onCodeApplied, className }: DiscountCodeInputProps) {
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
  const [discount, setDiscount] = useState(0)
  const [error, setError] = useState("")

  async function validateCode() {
    if (!code.trim()) return

    setStatus("checking")
    setError("")

    try {
      const res = await fetch("/api/credits/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await res.json()

      if (data.valid) {
        setStatus("valid")
        setDiscount(data.discountPercent)
        onCodeApplied(code.trim().toUpperCase(), data.discountPercent)
      } else {
        setStatus("invalid")
        setError(data.error || "Invalid code")
        onCodeApplied(null, 0)
      }
    } catch {
      setStatus("invalid")
      setError("Failed to validate code")
      onCodeApplied(null, 0)
    }
  }

  function clearCode() {
    setCode("")
    setStatus("idle")
    setDiscount(0)
    setError("")
    onCodeApplied(null, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      validateCode()
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Discount code (optional)"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              if (status !== "idle") setStatus("idle")
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "pl-10 uppercase font-mono",
              status === "valid" && "border-success text-success",
              status === "invalid" && "border-danger text-danger"
            )}
            disabled={status === "checking"}
          />
        </div>
        {status === "valid" ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearCode}
            className="shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={validateCode}
            disabled={!code.trim() || status === "checking"}
            className="shrink-0"
          >
            {status === "checking" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Apply"
            )}
          </Button>
        )}
      </div>

      {status === "valid" && (
        <div className="flex items-center gap-2 text-sm text-success">
          <Check className="w-4 h-4" />
          {discount === 100 ? "Free analysis!" : `${discount}% off applied`}
        </div>
      )}

      {status === "invalid" && (
        <p className="text-sm text-danger">{error}</p>
      )}
    </div>
  )
}

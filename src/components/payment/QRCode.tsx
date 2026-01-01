"use client"

import { QRCodeSVG } from 'qrcode.react'
import { motion } from 'framer-motion'

interface QRCodeProps {
  value: string
  size?: number
  className?: string
  isPending?: boolean
}

export function LightningQRCode({
  value,
  size = 200,
  className = '',
  isPending = true,
}: QRCodeProps) {
  // Add lightning: prefix for wallet compatibility
  const lightningUri = value.startsWith('lightning:') ? value : `lightning:${value}`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative inline-block ${className}`}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-primary/30 rounded-xl blur-xl" />

      {/* QR Code container */}
      <div className="relative p-4 bg-white rounded-xl shadow-xl">
        <QRCodeSVG
          value={lightningUri}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />

        {/* Lightning bolt overlay in center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-primary"
              fill="currentColor"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Pulsing animation when pending */}
      {isPending && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-primary/50"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.2, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  )
}

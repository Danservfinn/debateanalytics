import { NextRequest, NextResponse } from 'next/server'
import { createInvoice, generateCorrelationId } from '@/lib/strike'
import type { CreateInvoiceRequest, CreateInvoiceResponse } from '@/types/payment'

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000  // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateInvoiceResponse>> {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse request body
    const body: CreateInvoiceRequest = await request.json()
    const { analysisType, targetId } = body

    // Validate input
    if (!analysisType || !['user', 'thread'].includes(analysisType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid analysis type' },
        { status: 400 }
      )
    }

    if (!targetId || typeof targetId !== 'string' || targetId.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid target ID' },
        { status: 400 }
      )
    }

    // Sanitize targetId
    const sanitizedTargetId = targetId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50)

    // Generate correlation ID to prevent duplicate payments
    const correlationId = generateCorrelationId(analysisType, sanitizedTargetId)

    // Create descriptive message for invoice
    const description = analysisType === 'user'
      ? `Debate Analytics: Analyze Reddit user u/${sanitizedTargetId}`
      : `Debate Analytics: Deep analysis of Reddit thread ${sanitizedTargetId}`

    // Create the Lightning invoice via Strike API
    const invoice = await createInvoice(description, correlationId, '1.00')

    return NextResponse.json({
      success: true,
      invoice,
    })

  } catch (error) {
    console.error('Create invoice error:', error)

    // Check for specific errors
    if (error instanceof Error) {
      if (error.message.includes('STRIKE_API_KEY')) {
        return NextResponse.json(
          { success: false, error: 'Payment service not configured' },
          { status: 503 }
        )
      }
      if (error.message.includes('Strike API error')) {
        return NextResponse.json(
          { success: false, error: 'Payment service temporarily unavailable' },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

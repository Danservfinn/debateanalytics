import { NextRequest, NextResponse } from 'next/server'

// In-memory invoice store
const invoiceStore = new Map<string, {
  id: string
  arenaId: string
  amountSats: number
  amountUsd: number
  bolt11: string
  status: 'pending' | 'paid' | 'expired'
  expiresAt: string
  createdAt: string
}>()

/**
 * POST /api/arena/[arenaId]/create-invoice
 * Create a Lightning invoice for battle trigger
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  try {
    const { arenaId } = await params

    // Battle cost in USD
    const battleCostUsd = 2

    // Convert to sats (rough approximation - in production, use real exchange rate)
    // Assuming ~$100,000 per BTC
    const btcPrice = 100000
    const amountSats = Math.round((battleCostUsd / btcPrice) * 100000000)

    // Generate a mock invoice ID and bolt11
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // In production, this would call a Lightning node to create a real invoice
    // For demo, we create a mock bolt11 string
    const mockBolt11 = `lnbc${amountSats}n1pjdebateanalyticsarena${arenaId}${invoiceId}...${Math.random().toString(36).slice(2, 50)}`

    const invoice = {
      id: invoiceId,
      arenaId,
      amountSats,
      amountUsd: battleCostUsd,
      bolt11: mockBolt11,
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      createdAt: new Date().toISOString()
    }

    invoiceStore.set(invoiceId, invoice)

    // For demo purposes, auto-mark as paid after 5 seconds
    // In production, this would be handled by Lightning webhook
    setTimeout(() => {
      const inv = invoiceStore.get(invoiceId)
      if (inv && inv.status === 'pending') {
        inv.status = 'paid'
        invoiceStore.set(invoiceId, inv)
      }
    }, 5000)

    return NextResponse.json({
      success: true,
      data: {
        invoiceId: invoice.id,
        bolt11: invoice.bolt11,
        amountSats: invoice.amountSats,
        amountUsd: invoice.amountUsd,
        expiresAt: invoice.expiresAt
      }
    })
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

// Export the invoice store for other routes to use
export { invoiceStore }

import { NextRequest, NextResponse } from 'next/server'
import { invoiceStore } from '@/lib/arena-store'

/**
 * GET /api/arena/[arenaId]/check-payment
 * Check if a Lightning invoice has been paid
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ arenaId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'invoiceId is required' },
        { status: 400 }
      )
    }

    const invoice = invoiceStore.get(invoiceId)

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(invoice.expiresAt) < new Date() && invoice.status === 'pending') {
      invoice.status = 'expired'
      invoiceStore.set(invoiceId, invoice)
    }

    return NextResponse.json({
      success: true,
      paid: invoice.status === 'paid',
      status: invoice.status,
      expiresAt: invoice.expiresAt
    })
  } catch (error) {
    console.error('Check payment error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check payment' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceStatus } from '@/lib/strike'
import type { CheckPaymentResponse } from '@/types/payment'

export async function GET(request: NextRequest): Promise<NextResponse<CheckPaymentResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')

    // Validate input
    if (!invoiceId || typeof invoiceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    // Validate invoiceId format (UUID-like)
    if (!/^[a-zA-Z0-9-]{20,50}$/.test(invoiceId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid invoice ID format' },
        { status: 400 }
      )
    }

    // Check invoice status via Strike API
    const status = await getInvoiceStatus(invoiceId)

    return NextResponse.json({
      success: true,
      status,
    })

  } catch (error) {
    console.error('Check payment error:', error)

    // Check for specific errors
    if (error instanceof Error) {
      if (error.message.includes('STRIKE_API_KEY')) {
        return NextResponse.json(
          { success: false, error: 'Payment service not configured' },
          { status: 503 }
        )
      }
      // Invoice not found
      if (error.message.includes('404')) {
        return NextResponse.json(
          { success: false, error: 'Invoice not found' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to check payment status' },
      { status: 500 }
    )
  }
}

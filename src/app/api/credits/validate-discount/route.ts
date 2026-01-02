/**
 * POST /api/credits/validate-discount
 * Validates a discount code without consuming it
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateDiscountCode } from '@/lib/credits'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({
        valid: false,
        discountPercent: 0,
        error: 'Code required',
      })
    }

    // Validate the code (action is 'validation_check' to not count as actual usage)
    const result = await validateDiscountCode(code.trim(), 'validation_check')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Discount validation error:', error)
    return NextResponse.json({
      valid: false,
      discountPercent: 0,
      error: 'Validation failed',
    })
  }
}

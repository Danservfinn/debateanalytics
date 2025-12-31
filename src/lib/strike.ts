// Strike API Client - Server-side only
// https://docs.strike.me/api/

import type { StrikeInvoiceResponse, StrikeQuoteResponse, LightningInvoice, InvoiceStatus } from '@/types/payment'

const STRIKE_API_BASE = 'https://api.strike.me/v1'

interface StrikeConfig {
  apiKey: string
  environment?: 'production' | 'sandbox'
}

function getConfig(): StrikeConfig {
  const apiKey = process.env.STRIKE_API_KEY
  if (!apiKey) {
    throw new Error('STRIKE_API_KEY environment variable is not set')
  }
  return {
    apiKey,
    environment: (process.env.STRIKE_ENVIRONMENT as 'production' | 'sandbox') || 'production'
  }
}

async function strikeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getConfig()

  const response = await fetch(`${STRIKE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Strike API error:', response.status, errorBody)
    throw new Error(`Strike API error: ${response.status} - ${errorBody}`)
  }

  return response.json()
}

/**
 * Create a Lightning invoice for $1 USD
 */
export async function createInvoice(
  description: string,
  correlationId: string,
  amountUsd: string = '1.00'
): Promise<LightningInvoice> {
  // Step 1: Create the invoice
  const invoiceResponse = await strikeRequest<StrikeInvoiceResponse>('/invoices', {
    method: 'POST',
    body: JSON.stringify({
      correlationId,
      description,
      amount: {
        currency: 'USD',
        amount: amountUsd,
      },
    }),
  })

  // Step 2: Generate quote to get BOLT11 invoice
  const quoteResponse = await strikeRequest<StrikeQuoteResponse>(
    `/invoices/${invoiceResponse.invoiceId}/quote`,
    { method: 'POST' }
  )

  // Map Strike status to our status type
  const statusMap: Record<string, InvoiceStatus> = {
    'UNPAID': 'PENDING',
    'PENDING': 'PENDING',
    'PAID': 'PAID',
    'CANCELLED': 'CANCELLED',
  }

  return {
    invoiceId: invoiceResponse.invoiceId,
    lnInvoice: quoteResponse.lnInvoice,
    amount: {
      currency: 'USD',
      amount: amountUsd,
    },
    convertedAmount: {
      currency: 'BTC',
      amount: quoteResponse.sourceAmount?.amount || '0',
    },
    description,
    expiresAt: quoteResponse.expiration,
    createdAt: invoiceResponse.created,
    status: statusMap[invoiceResponse.state] || 'PENDING',
  }
}

/**
 * Check the status of an invoice
 */
export async function getInvoiceStatus(invoiceId: string): Promise<InvoiceStatus> {
  const response = await strikeRequest<StrikeInvoiceResponse>(`/invoices/${invoiceId}`)

  // Check if expired based on time
  const statusMap: Record<string, InvoiceStatus> = {
    'UNPAID': 'PENDING',
    'PENDING': 'PENDING',
    'PAID': 'PAID',
    'CANCELLED': 'CANCELLED',
  }

  return statusMap[response.state] || 'PENDING'
}

/**
 * Get full invoice details
 */
export async function getInvoice(invoiceId: string): Promise<StrikeInvoiceResponse> {
  return strikeRequest<StrikeInvoiceResponse>(`/invoices/${invoiceId}`)
}

/**
 * Generate a unique correlation ID for an analysis request
 */
export function generateCorrelationId(type: 'user' | 'thread', targetId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `debate-${type}-${targetId}-${timestamp}-${random}`
}

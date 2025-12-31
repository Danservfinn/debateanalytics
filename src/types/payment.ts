// Lightning Payment Types

export interface LightningInvoice {
  invoiceId: string
  lnInvoice: string           // BOLT11 payment request
  amount: {
    currency: 'USD'
    amount: string            // "1.00"
  }
  convertedAmount?: {
    currency: 'BTC'
    amount: string            // satoshis as string
  }
  description: string
  expiresAt: string           // ISO timestamp
  createdAt: string           // ISO timestamp
  status: InvoiceStatus
}

export type InvoiceStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'

export interface CreateInvoiceRequest {
  analysisType: 'user' | 'thread'
  targetId: string            // username or threadId
}

export interface CreateInvoiceResponse {
  success: boolean
  invoice?: LightningInvoice
  error?: string
}

export interface CheckPaymentRequest {
  invoiceId: string
}

export interface CheckPaymentResponse {
  success: boolean
  status?: InvoiceStatus
  error?: string
}

export type PaymentStatus =
  | 'idle'
  | 'creating'
  | 'pending'
  | 'paid'
  | 'expired'
  | 'error'

export interface PaymentState {
  invoice: LightningInvoice | null
  status: PaymentStatus
  error: string | null
}

// Stored in localStorage for payment persistence
export interface PaidAnalysis {
  type: 'user' | 'thread'
  targetId: string
  paidAt: number              // timestamp
  invoiceId: string
}

// Strike API response types (raw from API)
export interface StrikeInvoiceResponse {
  invoiceId: string
  amount: {
    amount: string
    currency: string
  }
  state: 'UNPAID' | 'PENDING' | 'PAID' | 'CANCELLED'
  created: string
  correlationId?: string
  description?: string
  issuerId: string
  receiverId: string
  payerId?: string
  payerCurrency?: string
}

export interface StrikeQuoteResponse {
  quoteId: string
  description?: string
  lnInvoice: string
  onchainAddress?: string
  expiration: string
  expirationInSec: number
  targetAmount: {
    amount: string
    currency: string
  }
  sourceAmount: {
    amount: string
    currency: string
  }
  conversionRate: {
    amount: string
    sourceCurrency: string
    targetCurrency: string
  }
}

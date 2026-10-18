export type PaymentStatus =
  "pending" | "completed" | "failed" | "cancelled" | "expired"

export type PaymentEnvironment = "test" | "live"

export type Payment = {
  id: string
  reference: string
  service: string
  externalOrderId: string | null
  amount: string
  currency: string
  environment: PaymentEnvironment
  status: PaymentStatus
  description: string
  checkoutUrl: string | null
  createdAt: string
  completedAt: string | null
  verifiedAt: string | null
}

export type StartPaymentInput = {
  externalOrderId: string
  amount: string
  currency?: "IRR"
  description: string
  returnUrl?: string
  metadata?: Record<string, unknown>
  /**
   * Optional caller-supplied idempotency key. If omitted, the SDK generates
   * one for the request. Reuse the same key when retrying that request.
   */
  idempotencyKey?: string
}

export type OBHPaymentsOptions = {
  /** Server-side service credential, e.g. svc_test_xxx.yyy. Never expose this. */
  secretKey: string
  /** OBH origin, e.g. http://localhost:3100. */
  baseUrl: string
  timeoutMs?: number
  fetch?: typeof fetch
}

export type APIErrorDetail = {
  field?: string
  message: string
}

export type APIErrorEnvelope = {
  error?: {
    code?: string
    message?: string
    requestId?: string
    details?: APIErrorDetail[]
  }
}

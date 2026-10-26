export type PaymentStatus =
  "pending" | "completed" | "failed" | "cancelled" | "expired"

export type PaymentEnvironment = "test" | "live"

/**
 * Customer-facing receipt and bank reconciliation details populated from
 * gateway verification (Sadad IPG).
 */
export type PaymentReceipt = {
  /** Unique numeric order ID sent to the payment gateway (`OrderId`). */
  orderNumber: string
  /** Transaction tracking number (`SystemTraceNo`). */
  traceNumber: string | null
  /** Transaction reference number (`RetrivalRefNo`). */
  referenceNumber: string | null
  /** Masked card number (`PrimaryAccNo`). */
  maskedCardNumber: string | null
  /** Gateway result code (`ResCode`). */
  resultCode: number | null
  /** Gateway result description (`Description`). */
  resultMessage: string | null
}

export type Payment = {
  id: string
  reference: string
  service: string
  externalOrderId: string | null
  /** Whole Rial integer amount (e.g. `"150000"`). */
  amount: string
  currency: string
  environment: PaymentEnvironment
  status: PaymentStatus
  description: string
  checkoutUrl: string | null
  receipt: PaymentReceipt
  createdAt: string
  completedAt: string | null
  verifiedAt: string | null
}

export type StartPaymentInput = {
  externalOrderId: string
  /** Positive whole Rial integer string (no decimals), e.g. `"150000"`. */
  amount: string
  currency?: "IRR"
  description: string
  returnUrl?: string
  metadata?: Record<string, unknown>
  /**
   * Optional per-request override for the OBH Sadad simulator.
   * Defaults to the client's `simulator` option or `process.env.OBH_SIMULATOR === "true"`.
   */
  simulator?: boolean
  /**
   * Optional caller-supplied idempotency key. If omitted, the SDK generates
   * one for the request. Reuse the same key when retrying that request.
   */
  idempotencyKey?: string
}

export type VerifyReturnInput =
  URL | string | URLSearchParams | Record<string, string | string[] | undefined>

export type OBHPaymentsOptions = {
  /** Server-side service credential, e.g. svc_xxx.yyy. Never expose this. */
  secretKey: string
  /**
   * Optional override for the OBH API origin. Defaults to `"https://obhco.ir/api/v1"`.
   */
  baseUrl?: string
  /**
   * When true, routes payments to the OBH Sadad simulator (`/pay/sadad/[token]`)
   * instead of the real Sadad gateway. Defaults to `process.env.OBH_SIMULATOR === "true"`.
   */
  simulator?: boolean
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

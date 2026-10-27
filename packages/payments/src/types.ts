export type PaymentStatus =
  "pending" | "completed" | "failed" | "cancelled" | "expired"

export type PaymentEnvironment = "test" | "live"

/**
 * Gateway code. OBH currently offers `"sadad"` (bank card, full payment) and
 * `"digipay"` (installments / BNPL). Use `listGateways()` for the live list.
 */
export type PaymentGatewayCode = "sadad" | "digipay" | (string & {})

export type PaymentGatewayKind = "card" | "installment"

/** A gateway the service can offer on its checkout page. */
export type PaymentGateway = {
  code: PaymentGatewayCode
  /** English name, e.g. `"Digipay (Installments / BNPL)"`. */
  name: string
  /** Persian label ready for a checkout page. */
  displayName: string
  description: string
  kind: PaymentGatewayKind
  /** When true, pass `customerMobile` to `startPayment`. */
  requiresCustomerMobile: boolean
  /** Minimum whole Rial amount, or `null` when the gateway sets none. */
  minAmount: string | null
  /** The gateway used when `startPayment` gets no `gateway`. */
  isDefault: boolean
  environment: PaymentEnvironment
}

export type ListGatewaysOptions = {
  /** List TEST simulator gateways. Defaults to the client's `simulator`. */
  simulator?: boolean
}

/**
 * Customer-facing receipt and bank reconciliation details populated from
 * gateway verification.
 */
export type PaymentReceipt = {
  /** Unique numeric order ID sent to the gateway (Sadad `OrderId`, Digipay `providerId`). */
  orderNumber: string
  /** Transaction tracking number (Sadad `SystemTraceNo`, Digipay `rrn`). */
  traceNumber: string | null
  /** Transaction reference number (Sadad `RetrivalRefNo`, Digipay `trackingCode`). */
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
  /** Gateway that processes this payment. */
  gateway: PaymentGatewayCode
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
   * Gateway the customer chose on your checkout page (a `code` from
   * `listGateways()`). Defaults to the OBH default gateway (`"sadad"`).
   */
  gateway?: PaymentGatewayCode
  /**
   * Customer mobile number, e.g. `"09121234567"`. Required by gateways with
   * `requiresCustomerMobile` (Digipay).
   */
  customerMobile?: string
  /**
   * Optional per-request override for the OBH gateway simulators.
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
   * When true, routes payments to the OBH gateway simulators
   * (`/pay/sadad/[token]`, `/pay/digipay/[ticket]`) instead of the real
   * gateways. Defaults to `process.env.OBH_SIMULATOR === "true"`.
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

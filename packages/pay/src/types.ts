/**
 * Gateway-level types. An adapter talks to one bank gateway; it knows nothing
 * about storage or OBH. The orchestrator in `pay.ts` combines adapters with a
 * `PaymentStore` and the finance reporter.
 */

export type ProviderPaymentStatus = "COMPLETED" | "FAILED" | "PENDING"

export type CheckoutSessionInput = {
  paymentReference: string
  /** Digits-only order number sent to the gateway (unique per terminal). */
  gatewayOrderId: string
  serviceSlug: string
  /** Whole Rials, as a digit string. */
  amount: string
  currency: "IRR"
  description: string
  returnUrl: string | null
  /** Public URL the gateway sends the customer back to. */
  callbackUrl: string
  metadata: Record<string, unknown>
  /** Customer mobile number (`09xxxxxxxxx`). Required by Digipay. */
  customerMobile?: string | null
}

/**
 * How the customer's browser gets to the bank. Most gateways take a plain
 * redirect; Mellat (Behpardakht) needs an auto-submitted POST form.
 */
export type CheckoutRedirect =
  | { method: "GET"; url: string }
  | { method: "POST"; url: string; fields: Record<string, string> }

export type CheckoutSession = {
  providerSessionId: string
  providerReference: string | null
  checkoutUrl: string | null
  /** Set when the redirect is not a plain GET of `checkoutUrl`. */
  redirect?: CheckoutRedirect
  expiresAt: Date
  resultCode: number
  resultMessage: string
}

export type VerifyPaymentInput = {
  providerSessionId: string | null
  providerReference: string | null
  gatewayOrderId?: string
  expectedAmount?: string
  payload?: Record<string, unknown>
}

export type VerifyPaymentResult = {
  status: ProviderPaymentStatus
  providerReference: string
  traceNumber: string | null
  maskedCardNumber: string | null
  resultCode: number
  resultMessage: string
  verifiedAmount: string | null
  verifiedOrderId: string | null
  verifiedAt: Date | null
  failureReason: string | null
  metadata: Record<string, unknown>
}

export type PaymentGatewayKind = "card" | "installment"

/** Public description of a gateway. Credentials never appear here. */
export type PaymentGatewayDescriptor = {
  code: string
  name: string
  /** Persian label suitable for a checkout page. */
  displayName: string
  description: string
  kind: PaymentGatewayKind
  requiresCustomerMobile: boolean
  minAmount: string | null
}

/**
 * What an adapter learned from the bank's callback request, before any
 * server-to-server verification.
 */
export type ParsedCallback = {
  /** Token / authority / RefId the gateway issued when the session opened. */
  sessionId: string | null
  /** Numeric order number echoed back by the gateway. */
  gatewayOrderId: string | null
  /** `verify` when the bank reports success; `failed` for cancel/decline. */
  outcome: "verify" | "failed"
  resultCode: number
  resultText: string
  providerReference: string | null
  maskedCardNumber: string | null
  /** Sanitised copy of the callback body, kept for audit and re-verify. */
  payload: Record<string, unknown>
}

export interface PaymentGatewayAdapter {
  readonly code: string
  readonly descriptor: PaymentGatewayDescriptor
  /** True when credentials are present in the environment. */
  isConfigured(): boolean
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>
  /** Reads the callback request body or query into a normalized shape. */
  parseCallback(payload: Record<string, string | null | undefined>): ParsedCallback
}

export class PaymentProviderError extends Error {
  code: string
  resultCode?: number

  constructor(code: string, message: string, resultCode?: number) {
    super(message)
    this.name = "PaymentProviderError"
    this.code = code
    this.resultCode = resultCode
  }
}

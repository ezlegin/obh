export type ProviderEnvironmentValue = "TEST" | "LIVE"

export type ProviderPaymentStatus = "COMPLETED" | "FAILED" | "PENDING"

export type CheckoutSessionInput = {
  paymentReference: string
  serviceSlug: string
  amount: string
  currency: "IRR"
  description: string
  returnUrl: string | null
  metadata: Record<string, unknown>
}

export type CheckoutSession = {
  providerSessionId: string
  providerReference: string
  checkoutUrl: string | null
  expiresAt: Date
}

export type VerifyPaymentInput = {
  providerSessionId: string | null
  providerReference: string | null
  payload?: Record<string, unknown>
}

export type VerifyPaymentResult = {
  status: ProviderPaymentStatus
  providerReference: string
  verifiedAt: Date | null
  failureReason: string | null
  metadata: Record<string, unknown>
}

export interface PaymentProviderAdapter {
  readonly code: string
  readonly supportedEnvironments: readonly ProviderEnvironmentValue[]
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>
}

export class PaymentProviderError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "PaymentProviderError"
    this.code = code
  }
}

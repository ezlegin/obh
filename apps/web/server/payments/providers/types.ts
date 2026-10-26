export type ProviderEnvironmentValue = "TEST" | "LIVE"

export type ProviderPaymentStatus = "COMPLETED" | "FAILED" | "PENDING"

export type CheckoutSessionInput = {
  paymentReference: string
  gatewayOrderId: string
  serviceSlug: string
  amount: string
  currency: "IRR"
  description: string
  returnUrl: string | null
  callbackUrl: string
  environment: ProviderEnvironmentValue
  metadata: Record<string, unknown>
}

export type CheckoutSession = {
  providerSessionId: string
  providerReference: string | null
  checkoutUrl: string | null
  expiresAt: Date
  resultCode: number
  resultMessage: string
  simulated: boolean
}

export type VerifyPaymentInput = {
  providerSessionId: string | null
  providerReference: string | null
  gatewayOrderId?: string
  expectedAmount?: string
  environment?: ProviderEnvironmentValue
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

export interface PaymentProviderAdapter {
  readonly code: string
  readonly supportedEnvironments: readonly ProviderEnvironmentValue[]
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>
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

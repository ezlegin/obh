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
  /** Customer mobile number (`09xxxxxxxxx`). Required by Digipay. */
  customerMobile?: string | null
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

export type PaymentGatewayKind = "card" | "installment"

/**
 * Public description of a gateway that connected services can offer at
 * checkout. Credentials and endpoints never appear here.
 */
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

export interface PaymentProviderAdapter {
  readonly code: string
  readonly descriptor: PaymentGatewayDescriptor
  readonly supportedEnvironments: readonly ProviderEnvironmentValue[]
  /** True when LIVE credentials are present in server environment variables. */
  isLiveConfigured(): boolean
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

import { randomUUID } from "node:crypto"

import {
  PaymentProviderError,
  type CheckoutSessionInput,
  type CheckoutSession,
  type PaymentProviderAdapter,
  type VerifyPaymentInput,
  type VerifyPaymentResult,
} from "./types"

export const DEVELOPMENT_PROVIDER_CODE = "development"

export function isDevelopmentProviderEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.OBH_ENABLE_DEVELOPMENT_PROVIDER === "true"
  )
}

/**
 * A local-only adapter used to exercise the payment lifecycle without real
 * provider credentials. It NEVER contacts a payment network and every result is
 * explicitly marked as simulated. Its payments are restricted to TEST mode.
 */
export const developmentPaymentAdapter: PaymentProviderAdapter = {
  code: DEVELOPMENT_PROVIDER_CODE,
  supportedEnvironments: ["TEST"],

  async createCheckoutSession(
    input: CheckoutSessionInput
  ): Promise<CheckoutSession> {
    if (input.currency !== "IRR") {
      throw new PaymentProviderError(
        "CURRENCY_NOT_SUPPORTED",
        "The development adapter only supports IRR."
      )
    }

    const providerSessionId = `dev_sess_${randomUUID().replaceAll("-", "")}`
    const providerReference = `dev_ref_${randomUUID().replaceAll("-", "")}`

    return {
      providerSessionId,
      providerReference,
      checkoutUrl: `/pay/dev/${providerSessionId}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }
  },

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!input.providerSessionId && !input.providerReference) {
      throw new PaymentProviderError(
        "INVALID_VERIFICATION_INPUT",
        "A provider session or reference is required."
      )
    }

    const outcome = input.payload?.outcome
    const providerReference =
      input.providerReference ?? `dev_ref_${randomUUID().replaceAll("-", "")}`
    const simulatedMetadata = {
      adapter: DEVELOPMENT_PROVIDER_CODE,
      simulated: true,
      environment: "TEST",
    }

    if (outcome === "success") {
      return {
        status: "COMPLETED",
        providerReference,
        verifiedAt: new Date(),
        failureReason: null,
        metadata: simulatedMetadata,
      }
    }

    if (outcome === "failure") {
      return {
        status: "FAILED",
        providerReference,
        verifiedAt: new Date(),
        failureReason: "Simulated provider failure.",
        metadata: simulatedMetadata,
      }
    }

    return {
      status: "PENDING",
      providerReference,
      verifiedAt: null,
      failureReason: null,
      metadata: simulatedMetadata,
    }
  },
}

import { createHash } from "node:crypto"

import { Prisma } from "@/lib/generated/prisma/client"

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    )
  }

  return value
}

export type PaymentRequestFingerprintInput = {
  externalOrderId: string
  amount: string
  currency: string
  description: string
  returnUrl: string
  metadata?: Record<string, unknown>
}

/**
 * A canonical fingerprint of the financial request. It is used only to detect
 * conflicts when an idempotency key or external order is reused.
 */
export function createPaymentRequestFingerprint(
  input: PaymentRequestFingerprintInput
) {
  const canonical = JSON.stringify(
    stableValue({
      externalOrderId: input.externalOrderId,
      amount: new Prisma.Decimal(input.amount).toFixed(2),
      currency: input.currency,
      description: input.description,
      returnUrl: input.returnUrl,
      metadata: input.metadata ?? null,
    })
  )

  return createHash("sha256").update(canonical, "utf8").digest("hex")
}

import assert from "node:assert/strict"
import test from "node:test"

import { toSnapshot } from "../../../packages/pay/src/report"
import type { PaymentRecord } from "../../../packages/pay/src/store"
import { financeEventSchema } from "../lib/validation/finance-events"

const base: PaymentRecord = {
  reference: "PAY-3F9A1C2B4D5E6F70",
  orderId: "AF-8821",
  attempt: 1,
  gateway: "zarinpal",
  gatewayOrderId: "1790000000001",
  amount: "150000",
  currency: "IRR",
  description: "Pro subscription",
  status: "pending",
  environment: "live",
  returnUrl: "https://afarinai.ir/orders/AF-8821",
  customerMobile: "09121234567",
  metadata: { plan: "pro", email: "a@b.c" },
  providerSessionId: "A0001",
  providerReference: null,
  traceNumber: null,
  maskedCardNumber: null,
  resultCode: 100,
  resultText: "created",
  installment: null,
  redirect: { method: "GET", url: "https://bank/pay" },
  callbackPayload: null,
  createdAt: new Date("2026-10-29T10:12:00Z"),
  expiresAt: new Date("2026-10-29T10:27:00Z"),
  callbackReceivedAt: null,
  completedAt: null,
  failedAt: null,
  reportedStatus: null,
  reportedAt: null,
}

function event(record: PaymentRecord, includeMetadata = false) {
  return {
    type: "payment.snapshot" as const,
    eventId: `${record.reference}:${record.status}`,
    sentAt: new Date().toISOString(),
    data: toSnapshot(record, includeMetadata),
  }
}

test("every status @obhco/pay can report passes OBH validation", () => {
  const at = new Date("2026-10-29T10:14:41Z")
  const variants: PaymentRecord[] = [
    base,
    {
      ...base,
      status: "completed",
      completedAt: at,
      callbackReceivedAt: at,
      providerReference: "123456789",
      traceNumber: "123456789",
      maskedCardNumber: "502229******5995",
    },
    { ...base, status: "failed", failedAt: at, resultCode: -51, resultText: "x" },
    { ...base, status: "expired", failedAt: at },
    { ...base, status: "cancelled", failedAt: at },
    { ...base, environment: "test" },
    { ...base, gateway: "mellat", attempt: 3 },
    {
      ...base,
      gateway: "digipay",
      status: "completed",
      completedAt: at,
      installment: { purchaseType: "BNPL", count: null },
    },
  ]

  for (const record of variants) {
    const parsed = financeEventSchema.safeParse(event(record))
    assert.ok(
      parsed.success,
      `${record.gateway}/${record.status}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`
    )
  }
})

test("private fields never leave the service unless metadata is opted in", () => {
  const withoutMetadata = JSON.stringify(event(base))
  assert.ok(!withoutMetadata.includes("09121234567"))
  assert.ok(!withoutMetadata.includes("afarinai.ir/orders"))
  assert.ok(!withoutMetadata.includes("a@b.c"))

  const withMetadata = financeEventSchema.parse(event(base, true))
  assert.deepEqual(withMetadata.data.metadata, base.metadata)
})

test("OBH rejects malformed amounts and unknown fields", () => {
  const bad = (patch: Record<string, unknown>) =>
    financeEventSchema.safeParse({
      ...event(base),
      data: { ...event(base).data, ...patch },
    }).success

  assert.equal(bad({ amount: "1500.5" }), false)
  assert.equal(bad({ amount: "0" }), false)
  assert.equal(bad({ currency: "USD" }), false)
  assert.equal(bad({ status: "refunded" }), false)
  assert.equal(bad({ gateway: "Sadad!" }), false)
  assert.equal(bad({ surprise: true }), false)
  assert.equal(bad({}), true)
})

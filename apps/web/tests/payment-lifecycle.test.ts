import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPaymentTransition,
  canTransitionPayment,
  InvalidPaymentTransitionError,
  isTerminalPaymentStatus,
  PAYMENT_EVENT_TYPES,
} from "../server/payments/lifecycle"

test("pending payments can reach each supported terminal state", () => {
  for (const status of [
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
  ] as const) {
    assert.equal(canTransitionPayment("PENDING", status), true)
    assert.doesNotThrow(() => assertPaymentTransition("PENDING", status))
  }
})

test("terminal payment states cannot transition again", () => {
  for (const terminal of [
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
  ] as const) {
    assert.equal(isTerminalPaymentStatus(terminal), true)

    for (const target of [
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "EXPIRED",
    ] as const) {
      assert.equal(canTransitionPayment(terminal, target), false)
    }
  }
})

test("invalid lifecycle transitions throw a typed error", () => {
  assert.throws(
    () => assertPaymentTransition("COMPLETED", "FAILED"),
    (error) =>
      error instanceof InvalidPaymentTransitionError &&
      error.from === "COMPLETED" &&
      error.to === "FAILED"
  )
})

test("event names are stable identifiers", () => {
  assert.deepEqual(PAYMENT_EVENT_TYPES, {
    CREATED: "payment.created",
    PROVIDER_SESSION_CREATED: "payment.provider_session_created",
    CALLBACK_RECEIVED: "payment.callback_received",
    VERIFIED: "payment.verified",
    FAILED: "payment.failed",
    CANCELLED: "payment.cancelled",
    EXPIRED: "payment.expired",
  })
})

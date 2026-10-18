import assert from "node:assert/strict"
import test from "node:test"

import { developmentPaymentAdapter } from "../server/payments/providers/development"

test("development adapter creates a TEST-only session with a local checkout", async () => {
  const session = await developmentPaymentAdapter.createCheckoutSession({
    paymentReference: "OBH-TESTREF",
    serviceSlug: "test-service",
    amount: "1000.00",
    currency: "IRR",
    description: "Test payment",
    returnUrl: null,
    metadata: {},
  })

  assert.match(session.providerSessionId, /^dev_sess_/)
  assert.match(session.providerReference, /^dev_ref_/)
  assert.match(session.checkoutUrl ?? "", /^\/pay\/dev\/dev_sess_/)
  assert.equal(session.expiresAt.getTime() > Date.now(), true)
  assert.deepEqual(developmentPaymentAdapter.supportedEnvironments, ["TEST"])
})

test("development adapter returns explicit simulated success", async () => {
  const result = await developmentPaymentAdapter.verifyPayment({
    providerSessionId: "dev_sess_test",
    providerReference: "dev_ref_test",
    payload: { outcome: "success" },
  })

  assert.equal(result.status, "COMPLETED")
  assert.equal(result.failureReason, null)
  assert.equal(result.metadata.simulated, true)
  assert.equal(result.metadata.environment, "TEST")
})

test("development adapter returns explicit simulated failure", async () => {
  const result = await developmentPaymentAdapter.verifyPayment({
    providerSessionId: "dev_sess_test",
    providerReference: "dev_ref_test",
    payload: { outcome: "failure" },
  })

  assert.equal(result.status, "FAILED")
  assert.match(result.failureReason ?? "", /Simulated/)
})

test("development adapter never assumes success without an explicit outcome", async () => {
  const result = await developmentPaymentAdapter.verifyPayment({
    providerSessionId: "dev_sess_test",
    providerReference: "dev_ref_test",
    payload: {},
  })

  assert.equal(result.status, "PENDING")
  assert.equal(result.verifiedAt, null)
})

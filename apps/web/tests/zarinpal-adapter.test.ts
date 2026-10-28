import assert from "node:assert/strict"
import { test } from "node:test"

import { zarinpalPaymentAdapter } from "../server/payments/providers/zarinpal"

const session = {
  paymentReference: "PAY-1",
  gatewayOrderId: "1001",
  serviceSlug: "demo",
  amount: "50000",
  currency: "IRR" as const,
  description: "Test",
  returnUrl: null,
  callbackUrl: "http://localhost/api/v1/zarinpal/callback",
  environment: "TEST" as const,
  metadata: {},
}

test("zarinpal simulator issues a local checkout and verifies OK", async () => {
  const checkout = await zarinpalPaymentAdapter.createCheckoutSession(session)
  assert.match(checkout.providerSessionId, /^zarinpal_sim_/)
  assert.equal(checkout.checkoutUrl?.startsWith("/pay/zarinpal/"), true)

  const ok = await zarinpalPaymentAdapter.verifyPayment({
    providerSessionId: checkout.providerSessionId,
    providerReference: null,
    expectedAmount: "50000",
    environment: "TEST",
    payload: { Authority: checkout.providerSessionId, Status: "OK" },
  })
  assert.equal(ok.status, "COMPLETED")
  assert.equal(ok.verifiedAmount, "50000")

  const nok = await zarinpalPaymentAdapter.verifyPayment({
    providerSessionId: checkout.providerSessionId,
    providerReference: null,
    environment: "TEST",
    payload: { Authority: checkout.providerSessionId, Status: "NOK" },
  })
  assert.equal(nok.status, "FAILED")
})

test("zarinpal rejects amounts under 10,000 R", async () => {
  await assert.rejects(
    zarinpalPaymentAdapter.createCheckoutSession({
      ...session,
      amount: "9999",
    }),
    /10,000/
  )
})

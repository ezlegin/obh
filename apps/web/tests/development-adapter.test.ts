import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import test from "node:test"

import {
  createSadadPaymentRequestSignData,
  createSadadVerifySignData,
  decryptSadadSignData,
  SADAD_PROVIDER_CODE,
  sadadPaymentAdapter,
} from "../server/payments/providers/sadad"

test("Sadad TripleDES ECB PKCS7 SignData round-trips PaymentRequest and Verify payloads", () => {
  const terminalKey = randomBytes(24).toString("base64")

  const paymentSign = createSadadPaymentRequestSignData({
    terminalId: "12345678",
    orderId: "1001",
    amount: "150000",
    terminalKey,
  })

  assert.equal(
    decryptSadadSignData(paymentSign, terminalKey),
    "12345678;1001;150000"
  )

  const verifySign = createSadadVerifySignData("tok_abc_123", terminalKey)
  assert.equal(decryptSadadSignData(verifySign, terminalKey), "tok_abc_123")
})

test("Sadad adapter creates a simulated TEST session with a local Sadad simulator URL", async () => {
  const session = await sadadPaymentAdapter.createCheckoutSession({
    paymentReference: "OBH-TESTREF",
    gatewayOrderId: "1001",
    serviceSlug: "afarin",
    amount: "150000",
    currency: "IRR",
    description: "Test payment",
    returnUrl: "https://afarinai.ir/payments/return",
    callbackUrl: "http://localhost:3100/api/v1/sadad/callback",
    environment: "TEST",
    metadata: {},
  })

  assert.match(session.providerSessionId, /^sadad_sim_/)
  assert.match(session.checkoutUrl ?? "", /^\/pay\/sadad\/sadad_sim_/)
  assert.equal(session.resultCode, 0)
  assert.equal(session.simulated, true)
  assert.deepEqual(sadadPaymentAdapter.supportedEnvironments, ["TEST", "LIVE"])
  assert.equal(sadadPaymentAdapter.code, SADAD_PROVIDER_CODE)
})

test("Sadad adapter rejects decimal amounts", async () => {
  await assert.rejects(
    () =>
      sadadPaymentAdapter.createCheckoutSession({
        paymentReference: "OBH-TESTREF",
        gatewayOrderId: "1001",
        serviceSlug: "afarin",
        amount: "150000.50",
        currency: "IRR",
        description: "Decimal Rial test",
        returnUrl: null,
        callbackUrl: "http://localhost:3100/api/v1/sadad/callback",
        environment: "TEST",
        metadata: {},
      }),
    /whole Rial integer/
  )
})

test("Sadad adapter returns simulated Verify success with trace and retrieval numbers", async () => {
  const result = await sadadPaymentAdapter.verifyPayment({
    providerSessionId: "sadad_sim_test",
    providerReference: null,
    gatewayOrderId: "1001",
    expectedAmount: "150000",
    environment: "TEST",
    payload: { outcome: "success" },
  })

  assert.equal(result.status, "COMPLETED")
  assert.equal(result.resultCode, 0)
  assert.ok(result.providerReference)
  assert.ok(result.traceNumber)
  assert.equal(result.verifiedAmount, "150000")
  assert.equal(result.verifiedOrderId, "1001")
  assert.equal(result.metadata.simulated, true)
})

test("Sadad adapter returns simulated Verify failure on non-zero ResCode", async () => {
  const result = await sadadPaymentAdapter.verifyPayment({
    providerSessionId: "sadad_sim_test",
    providerReference: null,
    gatewayOrderId: "1001",
    expectedAmount: "150000",
    environment: "TEST",
    payload: { ResCode: 1002 },
  })

  assert.equal(result.status, "FAILED")
  assert.equal(result.resultCode, 1002)
  assert.ok(result.failureReason)
})

test("Sadad adapter never assumes success without a callback or Verify result", async () => {
  const result = await sadadPaymentAdapter.verifyPayment({
    providerSessionId: "sadad_sim_test",
    providerReference: null,
    gatewayOrderId: "1001",
    expectedAmount: "150000",
    environment: "TEST",
    payload: {},
  })

  assert.equal(result.status, "PENDING")
  assert.equal(result.verifiedAt, null)
})

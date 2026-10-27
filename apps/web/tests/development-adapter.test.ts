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
import {
  DIGIPAY_PROVIDER_CODE,
  digipayPaymentAdapter,
  normalizeIranianMobile,
} from "../server/payments/providers/digipay"

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

test("Digipay adapter requires the customer mobile number", async () => {
  await assert.rejects(
    () =>
      digipayPaymentAdapter.createCheckoutSession({
        paymentReference: "OBH-TESTREF",
        gatewayOrderId: "1002",
        serviceSlug: "afarin",
        amount: "1500000",
        currency: "IRR",
        description: "Installment test",
        returnUrl: null,
        callbackUrl: "http://localhost:3100/api/v1/digipay/callback",
        environment: "TEST",
        metadata: {},
      }),
    /mobile number/
  )
})

test("Digipay adapter creates a simulated TEST ticket with a local simulator URL", async () => {
  const session = await digipayPaymentAdapter.createCheckoutSession({
    paymentReference: "OBH-TESTREF",
    gatewayOrderId: "1002",
    serviceSlug: "afarin",
    amount: "1500000",
    currency: "IRR",
    description: "Installment test",
    returnUrl: null,
    callbackUrl: "http://localhost:3100/api/v1/digipay/callback",
    environment: "TEST",
    metadata: {},
    customerMobile: "+989121234567",
  })

  assert.match(session.providerSessionId, /^digipay_sim_/)
  assert.match(session.checkoutUrl ?? "", /^\/pay\/digipay\/digipay_sim_/)
  assert.equal(session.simulated, true)
  assert.equal(digipayPaymentAdapter.code, DIGIPAY_PROVIDER_CODE)
  assert.equal(digipayPaymentAdapter.descriptor.kind, "installment")
})

test("Digipay adapter verifies a simulated SUCCESS callback", async () => {
  const result = await digipayPaymentAdapter.verifyPayment({
    providerSessionId: "digipay_sim_test",
    providerReference: null,
    gatewayOrderId: "1002",
    expectedAmount: "1500000",
    environment: "TEST",
    payload: {
      result: "SUCCESS",
      trackingCode: "TRK-1",
      providerId: "1002",
      amount: "1500000",
      type: 13,
    },
  })

  assert.equal(result.status, "COMPLETED")
  assert.equal(result.providerReference, "TRK-1")
  assert.equal(result.metadata.purchaseType, "BNPL")
})

test("Digipay adapter fails a callback whose amount or providerId does not match", async () => {
  const wrongAmount = await digipayPaymentAdapter.verifyPayment({
    providerSessionId: "digipay_sim_test",
    providerReference: null,
    gatewayOrderId: "1002",
    expectedAmount: "1500000",
    environment: "TEST",
    payload: {
      result: "SUCCESS",
      trackingCode: "TRK-1",
      providerId: "1002",
      amount: "1",
      type: 13,
    },
  })
  assert.equal(wrongAmount.status, "FAILED")

  const wrongOrder = await digipayPaymentAdapter.verifyPayment({
    providerSessionId: "digipay_sim_test",
    providerReference: null,
    gatewayOrderId: "1002",
    expectedAmount: "1500000",
    environment: "TEST",
    payload: {
      result: "SUCCESS",
      trackingCode: "TRK-1",
      providerId: "9999",
      amount: "1500000",
      type: 13,
    },
  })
  assert.equal(wrongOrder.status, "FAILED")
})

test("Digipay adapter treats FAILURE as failed and no callback as pending", async () => {
  const failed = await digipayPaymentAdapter.verifyPayment({
    providerSessionId: "digipay_sim_test",
    providerReference: null,
    gatewayOrderId: "1002",
    environment: "TEST",
    payload: { result: "FAILURE", providerId: "1002", type: 13 },
  })
  assert.equal(failed.status, "FAILED")

  const pending = await digipayPaymentAdapter.verifyPayment({
    providerSessionId: "digipay_sim_test",
    providerReference: null,
    gatewayOrderId: "1002",
    environment: "TEST",
    payload: {},
  })
  assert.equal(pending.status, "PENDING")
  assert.equal(pending.verifiedAt, null)
})

test("Iranian mobile numbers are normalized to 09xxxxxxxxx", () => {
  assert.equal(normalizeIranianMobile("+98 912 123 4567"), "09121234567")
  assert.equal(normalizeIranianMobile("۰۹۱۲۱۲۳۴۵۶۷"), "09121234567")
  assert.equal(normalizeIranianMobile("989121234567"), "09121234567")
  assert.equal(normalizeIranianMobile("12345"), null)
})

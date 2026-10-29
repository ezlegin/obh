import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import test from "node:test"

import {
  digipayPaymentAdapter,
  normalizeIranianMobile,
} from "../src/gateways/digipay.js"
import {
  buildMellatEnvelope,
  mellatLocalDateTime,
  mellatPaymentAdapter,
  parseMellatReturn,
} from "../src/gateways/mellat.js"
import {
  createSadadPaymentRequestSignData,
  createSadadVerifySignData,
  decryptSadadSignData,
  sadadPaymentAdapter,
} from "../src/gateways/sadad.js"
import { zarinpalPaymentAdapter } from "../src/gateways/zarinpal.js"

const session = {
  paymentReference: "PAY-1",
  gatewayOrderId: "1001",
  serviceSlug: "demo",
  amount: "50000",
  currency: "IRR" as const,
  description: "Test",
  returnUrl: null,
  callbackUrl: "https://shop.example/api/pay/x/callback",
  metadata: {},
}

test("Sadad TripleDES SignData round-trips PaymentRequest and Verify payloads", () => {
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

test("Sadad rejects decimal amounts before calling the bank", async () => {
  await assert.rejects(
    sadadPaymentAdapter.createCheckoutSession({ ...session, amount: "1500.5" })
  )
})

test("Sadad never assumes success without a Verify result", async () => {
  await assert.rejects(
    sadadPaymentAdapter.verifyPayment({
      providerSessionId: null,
      providerReference: null,
    })
  )
})

test("Sadad callback parsing separates success from failure", () => {
  const ok = sadadPaymentAdapter.parseCallback({
    Token: "tok_1",
    OrderId: "1001",
    ResCode: "0",
    PrimaryAccNo: "603799******1234",
  })
  assert.equal(ok.outcome, "verify")
  assert.equal(ok.sessionId, "tok_1")
  assert.equal(ok.gatewayOrderId, "1001")
  assert.equal(ok.maskedCardNumber, "603799******1234")

  const cancelled = sadadPaymentAdapter.parseCallback({
    Token: "tok_1",
    OrderId: "1001",
    ResCode: "17",
  })
  assert.equal(cancelled.outcome, "failed")

  const missing = sadadPaymentAdapter.parseCallback({ Token: "tok_1" })
  assert.equal(missing.outcome, "failed")
  assert.equal(missing.resultCode, -1)
})

test("Zarinpal rejects amounts under 10,000 R", async () => {
  await assert.rejects(
    zarinpalPaymentAdapter.createCheckoutSession({
      ...session,
      amount: "9999",
    }),
    /10,000/
  )
})

test("Zarinpal opens a session and verifies against the live API shape", async (t) => {
  process.env.ZARINPAL_MERCHANT_ID = "00000000-0000-0000-0000-000000000000"
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []

  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    calls.push({ url, body })
    const json = url.endsWith("/request.json")
      ? { data: { code: 100, message: "Success", authority: "A0001" } }
      : {
          data: {
            code: 100,
            message: "Verified",
            ref_id: 777,
            card_pan: "502229******5995",
          },
        }
    return new Response(JSON.stringify(json), {
      headers: { "content-type": "application/json" },
    })
  })

  const checkout = await zarinpalPaymentAdapter.createCheckoutSession(session)
  assert.equal(checkout.providerSessionId, "A0001")
  assert.match(checkout.checkoutUrl ?? "", /\/pg\/StartPay\/A0001$/)
  assert.equal(calls[0]?.body.amount, 50000)

  const parsed = zarinpalPaymentAdapter.parseCallback({
    Authority: "A0001",
    Status: "OK",
  })
  assert.equal(parsed.outcome, "verify")

  const verified = await zarinpalPaymentAdapter.verifyPayment({
    providerSessionId: "A0001",
    providerReference: null,
    gatewayOrderId: "1001",
    expectedAmount: "50000",
    payload: parsed.payload,
  })
  assert.equal(verified.status, "COMPLETED")
  assert.equal(verified.providerReference, "777")
  assert.equal(verified.verifiedAmount, "50000")

  const nok = zarinpalPaymentAdapter.parseCallback({
    Authority: "A0001",
    Status: "NOK",
  })
  assert.equal(nok.outcome, "failed")
})

test("Mellat envelope escapes values and parses the return string", () => {
  const xml = buildMellatEnvelope("bpPayRequest", [["additionalData", "a<b"]])
  assert.match(
    xml,
    /<int:bpPayRequest><additionalData>a&lt;b<\/additionalData>/
  )
  assert.equal(
    parseMellatReturn(
      "<soap:Envelope><soap:Body><ns2:bpPayRequestResponse><return>0,AF82041a2Bf6989c7f9</return></ns2:bpPayRequestResponse></soap:Body></soap:Envelope>"
    ),
    "0,AF82041a2Bf6989c7f9"
  )
})

test("Mellat local date and time use Tehran time", () => {
  // 2026-10-28 10:00 UTC is 13:30 in Tehran (UTC+3:30).
  assert.deepEqual(mellatLocalDateTime(new Date("2026-10-28T10:00:00Z")), {
    localDate: "20261028",
    localTime: "133000",
  })
})

test("Mellat callback needs RefId and SaleOrderId and maps cancellation", () => {
  const ok = mellatPaymentAdapter.parseCallback({
    RefId: "AF1",
    ResCode: "0",
    SaleOrderId: "1001",
    SaleReferenceId: "123456789",
    CardHolderPan: "603799******1234",
  })
  assert.equal(ok.outcome, "verify")
  assert.equal(ok.sessionId, "AF1")
  assert.equal(ok.gatewayOrderId, "1001")
  assert.equal(ok.providerReference, "123456789")

  const cancelled = mellatPaymentAdapter.parseCallback({
    RefId: "AF1",
    ResCode: "17",
    SaleOrderId: "1001",
  })
  assert.equal(cancelled.outcome, "failed")
  assert.equal(cancelled.resultCode, 17)
})

test("Digipay requires the customer mobile number", async () => {
  await assert.rejects(
    digipayPaymentAdapter.createCheckoutSession({ ...session }),
    /mobile/i
  )
})

test("Digipay callback maps providerId back to the order number", () => {
  const ok = digipayPaymentAdapter.parseCallback({
    providerId: "obh-1001",
    result: "SUCCESS",
    trackingCode: "T-9",
    type: "5",
  })
  assert.equal(ok.outcome, "verify")
  assert.equal(ok.gatewayOrderId, "1001")
  assert.equal(ok.providerReference, "T-9")

  const failed = digipayPaymentAdapter.parseCallback({
    providerId: "obh-1001",
    result: "FAILURE",
  })
  assert.equal(failed.outcome, "failed")
})

test("Iranian mobile numbers are normalized to 09xxxxxxxxx", () => {
  assert.equal(normalizeIranianMobile("+98 912 123 4567"), "09121234567")
  assert.equal(normalizeIranianMobile("۰۹۱۲۱۲۳۴۵۶۷"), "09121234567")
  assert.equal(normalizeIranianMobile("989121234567"), "09121234567")
  assert.equal(normalizeIranianMobile("12345"), null)
})

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildMellatEnvelope,
  mellatLocalDateTime,
  mellatPaymentAdapter,
  parseMellatReturn,
} from "../server/payments/providers/mellat"

test("mellat envelope escapes values and parses the return string", () => {
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

test("mellat local date and time use Tehran time", () => {
  // 2026-10-28 10:00 UTC is 13:30 in Tehran (UTC+3:30).
  assert.deepEqual(mellatLocalDateTime(new Date("2026-10-28T10:00:00Z")), {
    localDate: "20261028",
    localTime: "133000",
  })
})

test("mellat simulator completes on ResCode 0 and fails on 17", async () => {
  const checkout = await mellatPaymentAdapter.createCheckoutSession({
    paymentReference: "PAY-1",
    gatewayOrderId: "1001",
    serviceSlug: "demo",
    amount: "50000",
    currency: "IRR",
    description: "Test",
    returnUrl: null,
    callbackUrl: "http://localhost/api/v1/mellat/callback",
    environment: "TEST",
    metadata: {},
  })
  assert.match(checkout.providerSessionId, /^mellat_sim_/)

  const payload = {
    RefId: checkout.providerSessionId,
    SaleOrderId: "1001",
    SaleReferenceId: "123456789",
  }
  const ok = await mellatPaymentAdapter.verifyPayment({
    providerSessionId: checkout.providerSessionId,
    providerReference: null,
    gatewayOrderId: "1001",
    expectedAmount: "50000",
    environment: "TEST",
    payload: { ...payload, ResCode: "0" },
  })
  assert.equal(ok.status, "COMPLETED")
  assert.equal(ok.providerReference, "123456789")

  const cancelled = await mellatPaymentAdapter.verifyPayment({
    providerSessionId: checkout.providerSessionId,
    providerReference: null,
    gatewayOrderId: "1001",
    environment: "TEST",
    payload: { ...payload, ResCode: "17" },
  })
  assert.equal(cancelled.status, "FAILED")

  const wrongOrder = await mellatPaymentAdapter.verifyPayment({
    providerSessionId: checkout.providerSessionId,
    providerReference: null,
    gatewayOrderId: "999",
    environment: "TEST",
    payload: { ...payload, ResCode: "0" },
  })
  assert.equal(wrongOrder.status, "FAILED")
})

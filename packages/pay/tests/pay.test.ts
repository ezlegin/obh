import assert from "node:assert/strict"
import test from "node:test"

import {
  callbackRoute,
  createPay,
  isPayError,
  MemoryPaymentStore,
  redirectResponse,
  type PaymentGatewayAdapter,
  type PaymentRecord,
} from "../src/index.js"

type Behaviour = {
  verify?: "COMPLETED" | "FAILED" | "PENDING"
  verifiedAmount?: string | null
  purchaseType?: string
  throwOnVerify?: boolean
}

function fakeGateway(behaviour: Behaviour = {}): PaymentGatewayAdapter {
  let sessions = 0

  return {
    code: "fake",
    descriptor: {
      code: "fake",
      name: "Fake",
      displayName: "Fake",
      description: "Test gateway",
      kind: "card",
      requiresCustomerMobile: false,
      minAmount: "10000",
    },
    isConfigured: () => true,
    async createCheckoutSession(input) {
      sessions += 1
      return {
        providerSessionId: `S${sessions}`,
        providerReference: null,
        checkoutUrl: `https://bank.example/pay/S${sessions}?o=${input.gatewayOrderId}`,
        expiresAt: new Date(Date.now() + 15 * 60_000),
        resultCode: 0,
        resultMessage: "ok",
      }
    },
    async verifyPayment(input) {
      if (behaviour.throwOnVerify) {
        throw new Error("network down")
      }
      const status = behaviour.verify ?? "COMPLETED"
      return {
        status,
        providerReference: "RRN-1",
        traceNumber: "TRACE-1",
        maskedCardNumber: "603799******1234",
        resultCode: 0,
        resultMessage: "verified",
        verifiedAmount:
          behaviour.verifiedAmount === undefined
            ? (input.expectedAmount ?? null)
            : behaviour.verifiedAmount,
        verifiedOrderId: input.gatewayOrderId ?? null,
        verifiedAt: new Date(),
        failureReason: status === "FAILED" ? "declined" : null,
        metadata: behaviour.purchaseType
          ? { purchaseType: behaviour.purchaseType }
          : {},
      }
    },
    parseCallback(payload) {
      return {
        sessionId: payload.session ?? null,
        gatewayOrderId: payload.order ?? null,
        outcome: payload.ok === "1" ? "verify" : "failed",
        resultCode: payload.ok === "1" ? 0 : 17,
        resultText: payload.ok === "1" ? "ok" : "cancelled",
        providerReference: null,
        maskedCardNumber: null,
        payload: { ...payload },
      }
    },
  }
}

type Sent = { url: string; body: { data: { status: string; reference: string } } }

function setup(behaviour: Behaviour = {}, reportOk = true) {
  const store = new MemoryPaymentStore()
  const sent: Sent[] = []
  const reportErrors: unknown[] = []

  const pay = createPay({
    service: "shop",
    baseUrl: "https://shop.example",
    store,
    gateways: [fakeGateway(behaviour)],
    report: {
      baseUrl: "https://obh.example",
      secretKey: "key.secret",
      fetch: (async (url: string, init: RequestInit) => {
        if (!reportOk) {
          return new Response("{}", { status: 503 })
        }
        sent.push({ url, body: JSON.parse(String(init.body)) })
        return new Response("{}", { status: 200 })
      }) as typeof fetch,
    },
    onReportError: (error) => reportErrors.push(error),
  })

  return { pay, store, sent, reportErrors }
}

const order = {
  orderId: "AF-1",
  amount: "150000",
  description: "Pro plan",
  returnUrl: "https://shop.example/orders/AF-1",
}

test("start stores the attempt before redirecting and builds the callback URL", async () => {
  const { pay, store } = setup()
  const started = await pay.start(order)

  assert.equal(started.payment.status, "pending")
  assert.equal(started.redirect.method, "GET")
  assert.match(started.redirect.url, /bank\.example/)

  const stored = await store.findByReference(started.payment.reference)
  assert.equal(stored?.providerSessionId, "S1")
  assert.equal(stored?.attempt, 1)
})

test("a double click reuses the open session instead of opening a second one", async () => {
  const { pay } = setup()
  const first = await pay.start(order)
  const second = await pay.start(order)

  assert.equal(second.reused, true)
  assert.equal(second.payment.reference, first.payment.reference)
})

test("invalid input is rejected with INVALID_REQUEST", async () => {
  const { pay } = setup()

  for (const bad of [
    { ...order, amount: "1500.5" },
    { ...order, amount: "0" },
    { ...order, amount: "5000" },
    { ...order, orderId: " " },
    { ...order, description: "" },
  ]) {
    await assert.rejects(pay.start(bad), (error) => {
      assert.ok(isPayError(error))
      assert.equal(error.code, "INVALID_REQUEST")
      return true
    })
  }
})

test("a verified callback completes the payment and reports it to OBH", async () => {
  const { pay, sent } = setup()
  const { payment } = await pay.start(order)

  const result = await pay.handleCallback("fake", {
    session: "S1",
    order: payment.gatewayOrderId,
    ok: "1",
  })

  assert.equal(result.payment.status, "completed")
  assert.equal(result.payment.traceNumber, "TRACE-1")
  assert.equal(result.replayed, false)

  const completed = sent.find((event) => event.body.data.status === "completed")
  assert.ok(completed)
  assert.equal(completed.url, "https://obh.example/api/v1/finance/events")
  assert.equal(completed.body.data.reference, payment.reference)

  const stored = await pay.get(payment.reference)
  assert.equal(stored?.reportedStatus, "completed")
})

test("replaying a callback never completes twice or re-reports", async () => {
  const { pay, sent } = setup()
  const { payment } = await pay.start(order)
  const payload = { session: "S1", order: payment.gatewayOrderId, ok: "1" }

  await pay.handleCallback("fake", payload)
  const before = sent.length
  const again = await pay.handleCallback("fake", payload)

  assert.equal(again.replayed, true)
  assert.equal(again.payment.status, "completed")
  assert.equal(sent.length, before)
})

test("a cancelled callback fails the payment without calling verify", async () => {
  const { pay } = setup({ throwOnVerify: true })
  const { payment } = await pay.start(order)

  const result = await pay.handleCallback("fake", {
    session: "S1",
    order: payment.gatewayOrderId,
    ok: "0",
  })

  assert.equal(result.payment.status, "failed")
  assert.equal(result.payment.resultCode, 17)
})

test("a bank-verified amount that differs is never marked paid", async () => {
  const { pay } = setup({ verifiedAmount: "100" })
  const { payment } = await pay.start(order)

  const result = await pay.handleCallback("fake", {
    session: "S1",
    order: payment.gatewayOrderId,
    ok: "1",
  })

  assert.equal(result.payment.status, "failed")
  assert.match(result.payment.resultText ?? "", /Amount mismatch/)
})

test("a callback for another order number is rejected", async () => {
  const { pay } = setup()
  await pay.start(order)

  await assert.rejects(
    pay.handleCallback("fake", { session: "S1", order: "999", ok: "1" }),
    (error) => isPayError(error) && error.code === "ORDER_MISMATCH"
  )
  await assert.rejects(
    pay.handleCallback("fake", { session: "NOPE", ok: "1" }),
    (error) => isPayError(error) && error.code === "PAYMENT_NOT_FOUND"
  )
})

test("a verify network error keeps the payment pending for reconcile", async () => {
  const { pay, store } = setup({ throwOnVerify: true })
  const { payment } = await pay.start(order)

  const result = await pay.handleCallback("fake", {
    session: "S1",
    order: payment.gatewayOrderId,
    ok: "1",
  })

  assert.equal(result.payment.status, "pending")
  assert.ok(result.payment.callbackReceivedAt)
  assert.equal((await store.listPending(new Date(Date.now() + 1000), 10)).length, 1)
})

test("an order that is already paid cannot be paid again", async () => {
  const { pay } = setup()
  const { payment } = await pay.start(order)
  await pay.handleCallback("fake", {
    session: "S1",
    order: payment.gatewayOrderId,
    ok: "1",
  })

  await assert.rejects(
    pay.start(order),
    (error) => isPayError(error) && error.code === "ORDER_ALREADY_PAID"
  )
})

test("a retry after a failure is a new attempt on the same order", async () => {
  const { pay } = setup()
  const first = await pay.start(order)
  await pay.handleCallback("fake", {
    session: "S1",
    order: first.payment.gatewayOrderId,
    ok: "0",
  })

  const second = await pay.start(order)
  assert.notEqual(second.payment.reference, first.payment.reference)
  assert.equal(second.payment.attempt, 2)
})

test("reporting failures never block payment; reconcile re-sends them", async () => {
  const store = new MemoryPaymentStore()
  let online = false
  const sent: string[] = []
  const pay = createPay({
    service: "shop",
    baseUrl: "https://shop.example",
    store,
    gateways: [fakeGateway()],
    report: {
      baseUrl: "https://obh.example",
      secretKey: "key.secret",
      fetch: (async (_url: string, init: RequestInit) => {
        if (!online) {
          return new Response("{}", { status: 503 })
        }
        sent.push(JSON.parse(String(init.body)).data.status)
        return new Response("{}", { status: 200 })
      }) as typeof fetch,
    },
  })

  const { payment } = await pay.start(order)
  const result = await pay.handleCallback("fake", {
    session: "S1",
    order: payment.gatewayOrderId,
    ok: "1",
  })
  assert.equal(result.payment.status, "completed")
  assert.equal((await pay.get(payment.reference))?.reportedStatus, null)

  online = true
  const summary = await pay.reconcile()
  assert.equal(summary.reported, 1)
  assert.deepEqual(sent, ["completed"])
  assert.equal((await pay.get(payment.reference))?.reportedStatus, "completed")
})

test("reconcile expires abandoned sessions", async () => {
  const { pay, store } = setup()
  const { payment } = await pay.start(order)
  await store.update(payment.reference, {
    createdAt: new Date(Date.now() - 60 * 60_000),
  })

  const summary = await pay.reconcile()
  assert.equal(summary.expired, 1)
  assert.equal((await pay.get(payment.reference))?.status, "expired")
})

test("installment purchases carry their purchase type to OBH", async () => {
  const { pay } = setup({ purchaseType: "BNPL" })
  const { payment } = await pay.start(order)
  const result = await pay.handleCallback("fake", {
    session: "S1",
    order: payment.gatewayOrderId,
    ok: "1",
  })

  assert.deepEqual(result.payment.installment, {
    purchaseType: "BNPL",
    count: null,
  })
})

test("redirectResponse renders POST gateways as an auto-submitting form", async () => {
  const response = redirectResponse({
    method: "POST",
    url: "https://bpm.shaparak.ir/pgwchannel/startpay.mellat",
    fields: { RefId: 'A"B' },
  })
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /name="RefId" value="A&quot;B"/)
  assert.match(html, /action="https:\/\/bpm\.shaparak\.ir/)
  assert.equal(
    redirectResponse({ method: "GET", url: "https://x.test/p" }).headers.get(
      "location"
    ),
    "https://x.test/p"
  )
})

test("callbackRoute redirects to the return URL with reference and status", async () => {
  const { pay } = setup()
  const { payment } = await pay.start(order)
  const route = callbackRoute(pay, "fake", {
    fallbackUrl: "https://shop.example/checkout",
  })

  const response = await route(
    new Request(
      `https://shop.example/api/pay/fake/callback?session=S1&order=${payment.gatewayOrderId}&ok=1`
    )
  )
  const location = new URL(response.headers.get("location") ?? "")

  assert.equal(response.status, 303)
  assert.equal(location.pathname, "/orders/AF-1")
  assert.equal(location.searchParams.get("status"), "completed")
  assert.equal(location.searchParams.get("reference"), payment.reference)

  const failure = await route(
    new Request("https://shop.example/api/pay/fake/callback?session=NOPE&ok=1")
  )
  const failureUrl = new URL(failure.headers.get("location") ?? "")
  assert.equal(failureUrl.searchParams.get("status"), "error")
  assert.equal(failureUrl.searchParams.get("code"), "PAYMENT_NOT_FOUND")
})

test("records survive a store round trip with their types intact", async () => {
  const { pay } = setup()
  const { payment } = await pay.start(order)
  const stored: PaymentRecord | null = await pay.get(payment.reference)

  assert.ok(stored?.createdAt instanceof Date)
  assert.equal(stored?.currency, "IRR")
})

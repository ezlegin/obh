import assert from "node:assert/strict"
import test from "node:test"

import {
  isOBHPaymentsError,
  OBHPayments,
  OBHPaymentsError,
} from "../src/index.js"

const payment = {
  id: "018f0000-0000-7000-8000-000000000001",
  reference: "OBH-ABC12345",
  service: "afarin",
  externalOrderId: "AF-1",
  amount: "150000",
  currency: "IRR",
  environment: "test" as const,
  gateway: "sadad",
  status: "pending" as const,
  description: "Test",
  checkoutUrl: "http://localhost:3100/pay/sadad/sadad_tok_x",
  receipt: {
    orderNumber: "1001",
    traceNumber: null,
    referenceNumber: null,
    maskedCardNumber: null,
    resultCode: 0,
    resultMessage: "درخواست تراکنش با موفقیت ثبت شد",
  },
  createdAt: "2026-10-18T00:00:00.000Z",
  completedAt: null,
  verifiedAt: null,
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

test("refuses to execute in a browser", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window")

  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  })

  try {
    assert.throws(
      () =>
        new OBHPayments({
          secretKey: "svc_test_key.secret",
          baseUrl: "http://localhost:3100",
        }),
      /server-only/
    )
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor)
    } else {
      Reflect.deleteProperty(globalThis, "window")
    }
  }
})

test("rejects unsafe base URLs, malformed credentials, and decimal amounts", async () => {
  assert.throws(
    () =>
      new OBHPayments({
        secretKey: "svc_test_key.secret",
        baseUrl: "http://pay.obh.example",
      }),
    /HTTPS/
  )

  assert.throws(
    () =>
      new OBHPayments({
        secretKey: "not-a-key",
        baseUrl: "http://localhost:3100",
      }),
    /service credential/
  )

  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
  })

  await assert.rejects(
    () =>
      client.startPayment({
        externalOrderId: "AF-1",
        amount: "150000.50",
        description: "Decimal Rials not allowed",
      }),
    /whole Rial integer/
  )
})

test("sends service auth and an idempotency key when starting a payment", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    fetch: async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} })
      return jsonResponse({ data: payment }, 201)
    },
  })

  const result = await client.startPayment({
    externalOrderId: "AF-1",
    amount: "150000",
    description: "Test",
    returnUrl: "https://afarinai.ir/payments/return",
    metadata: { plan: "annual" },
  })

  assert.equal(result.reference, "OBH-ABC12345")
  assert.equal(result.receipt.orderNumber, "1001")
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, "https://obhco.ir/api/v1/payments")
  const headers = new Headers(calls[0]?.init.headers)
  assert.equal(headers.get("authorization"), "Bearer svc_test_key.secret")
  assert.match(headers.get("idempotency-key") ?? "", /^sdk_/)
  const body = JSON.parse(String(calls[0]?.init.body))
  assert.deepEqual(body, {
    externalOrderId: "AF-1",
    amount: "150000",
    currency: "IRR",
    description: "Test",
    simulator: false,
    returnUrl: "https://afarinai.ir/payments/return",
    metadata: { plan: "annual" },
  })
})

test("reuses a caller-supplied idempotency key and verifies return URLs", async () => {
  const calls: Array<{ url: string; method: string; key: string | null }> = []
  const completedPayment = {
    ...payment,
    status: "completed" as const,
    receipt: {
      orderNumber: "1001",
      traceNumber: "654321",
      referenceNumber: "987654321012",
      maskedCardNumber: "603799******1234",
      resultCode: 0,
      resultMessage: "عملیات با موفقیت انجام شد",
    },
  }

  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100/api/v1",
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers)
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        key: headers.get("idempotency-key"),
      })
      return jsonResponse({ data: completedPayment })
    },
  })

  await client.startPayment({
    externalOrderId: "AF-1",
    amount: "150000",
    description: "Test",
    idempotencyKey: "retry-1",
  })

  const verified = await client.verifyReturn(
    "https://afarinai.ir/payments/return?obh_reference=OBH-ABC12345&status=completed",
    { expectedOrderId: "AF-1", expectedAmount: "150000" }
  )

  assert.equal(calls[0]?.key, "retry-1")
  assert.equal(calls[1]?.method, "GET")
  assert.equal(
    calls[1]?.url,
    "http://localhost:3100/api/v1/payments/OBH-ABC12345"
  )
  assert.equal(verified.status, "completed")
  assert.equal(verified.receipt.traceNumber, "654321")
  assert.equal(verified.receipt.referenceNumber, "987654321012")
})

test("maps API error envelopes to typed SDK errors", async () => {
  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
    fetch: async () =>
      jsonResponse(
        {
          error: {
            code: "ORDER_CONFLICT",
            message: "This external order already exists.",
            requestId: "req_test",
            details: [{ field: "externalOrderId", message: "Already used." }],
          },
        },
        409
      ),
  })

  await assert.rejects(
    () =>
      client.startPayment({
        externalOrderId: "AF-1",
        amount: "150000",
        description: "Test",
      }),
    (error) =>
      isOBHPaymentsError(error) &&
      error.code === "ORDER_CONFLICT" &&
      error.status === 409 &&
      error.requestId === "req_test" &&
      error.details?.[0]?.field === "externalOrderId"
  )
})

test("marks 5xx errors as retryable and 4xx errors as non-retryable", async () => {
  const serverErrorClient = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
    fetch: async () =>
      jsonResponse(
        { error: { code: "PROVIDER_ERROR", message: "Provider failed." } },
        502
      ),
  })

  await assert.rejects(
    () =>
      serverErrorClient.startPayment({
        externalOrderId: "AF-1",
        amount: "150000",
        description: "Test",
      }),
    (error) => error instanceof OBHPaymentsError && error.retryable === true
  )
})

test("maps aborted requests to retryable timeouts", async () => {
  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
    timeoutMs: 5,
    fetch: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("Aborted")
          error.name = "AbortError"
          reject(error)
        })
      }),
  })

  await assert.rejects(
    () => client.getPayment("OBH-ABC12345"),
    (error) =>
      isOBHPaymentsError(error) &&
      error.code === "TIMEOUT" &&
      error.retryable === true
  )
})

test("lists available gateways for the checkout page", async () => {
  let requestedUrl = ""
  const gateways = [
    {
      code: "sadad",
      name: "Sadad (Bank Melli Iran)",
      displayName: "پرداخت با کارت بانکی (سداد)",
      description: "Pay in full with a bank card.",
      kind: "card",
      requiresCustomerMobile: false,
      minAmount: null,
      isDefault: true,
      environment: "test",
    },
    {
      code: "digipay",
      name: "Digipay (Installments / BNPL)",
      displayName: "خرید اقساطی با دیجی‌پی",
      description: "Pay in installments.",
      kind: "installment",
      requiresCustomerMobile: true,
      minAmount: null,
      isDefault: false,
      environment: "test",
    },
  ]

  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
    simulator: true,
    fetch: async (input) => {
      requestedUrl = String(input)
      return jsonResponse({ data: gateways })
    },
  })

  const result = await client.listGateways()

  assert.equal(
    requestedUrl,
    "http://localhost:3100/api/v1/gateways?simulator=true"
  )
  assert.deepEqual(
    result.map((gateway) => gateway.code),
    ["sadad", "digipay"]
  )
  assert.equal(result[1]?.requiresCustomerMobile, true)
})

test("sends the chosen gateway and customer mobile when starting a payment", async () => {
  let sentBody: Record<string, unknown> = {}

  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
    fetch: async (_input, init) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return jsonResponse({ data: { ...payment, gateway: "digipay" } }, 201)
    },
  })

  const result = await client.startPayment({
    externalOrderId: "AF-2",
    amount: "150000",
    description: "Installment test",
    gateway: "digipay",
    customerMobile: "09121234567",
  })

  assert.equal(sentBody.gateway, "digipay")
  assert.deepEqual(sentBody.customer, { mobile: "09121234567" })
  assert.equal(result.gateway, "digipay")
})

test("rejects invalid gateway codes and mobile numbers before calling the API", async () => {
  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
    fetch: async () => {
      throw new Error("fetch should not be called")
    },
  })

  await assert.rejects(
    () =>
      client.startPayment({
        externalOrderId: "AF-3",
        amount: "150000",
        description: "Bad gateway",
        gateway: "Digi Pay!",
      }),
    /gateway must be a code/
  )

  await assert.rejects(
    () =>
      client.startPayment({
        externalOrderId: "AF-3",
        amount: "150000",
        description: "Bad mobile",
        gateway: "digipay",
        customerMobile: "12345",
      }),
    /customerMobile/
  )
})

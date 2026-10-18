import assert from "node:assert/strict"
import test from "node:test"

import {
  isOBHPaymentsError,
  OBHPayments,
  OBHPaymentsError,
} from "../src/index.js"

const payment = {
  id: "018f0000-0000-7000-8000-000000000001",
  reference: "OBH-ABC123",
  service: "igraphical",
  externalOrderId: "IG-1",
  amount: "1000.00",
  currency: "IRR",
  environment: "test" as const,
  status: "pending" as const,
  description: "Test",
  checkoutUrl: "http://localhost:3100/pay/dev/dev_sess_x",
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

test("rejects unsafe base URLs and malformed credentials", () => {
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

  assert.doesNotThrow(
    () =>
      new OBHPayments({
        secretKey: "svc_test_key.secret",
        baseUrl: "http://localhost:3100",
      })
  )
})

test("sends service auth and an idempotency key when starting a payment", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const client = new OBHPayments({
    secretKey: "svc_test_key.secret",
    baseUrl: "http://localhost:3100",
    fetch: async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} })
      return jsonResponse({ data: payment }, 201)
    },
  })

  const result = await client.startPayment({
    externalOrderId: "IG-1",
    amount: "1000",
    description: "Test",
    returnUrl: "https://igraphical.ir/payments/return",
    metadata: { plan: "annual" },
  })

  assert.equal(result.reference, "OBH-ABC123")
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, "http://localhost:3100/api/v1/payments")
  const headers = new Headers(calls[0]?.init.headers)
  assert.equal(headers.get("authorization"), "Bearer svc_test_key.secret")
  assert.match(headers.get("idempotency-key") ?? "", /^sdk_/)
  const body = JSON.parse(String(calls[0]?.init.body))
  assert.deepEqual(body, {
    externalOrderId: "IG-1",
    amount: "1000",
    currency: "IRR",
    description: "Test",
    returnUrl: "https://igraphical.ir/payments/return",
    metadata: { plan: "annual" },
  })
})

test("reuses a caller-supplied idempotency key and retrieves by encoded reference", async () => {
  const calls: Array<{ url: string; method: string; key: string | null }> = []
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
      return jsonResponse({ data: payment })
    },
  })

  await client.startPayment({
    externalOrderId: "IG-1",
    amount: "1000",
    description: "Test",
    idempotencyKey: "retry-1",
  })
  await client.getPayment("OBH-ABC123")

  assert.equal(calls[0]?.key, "retry-1")
  assert.equal(calls[1]?.method, "GET")
  assert.equal(
    calls[1]?.url,
    "http://localhost:3100/api/v1/payments/OBH-ABC123"
  )
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
        externalOrderId: "IG-1",
        amount: "1000",
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
        externalOrderId: "IG-1",
        amount: "1000",
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
    () => client.getPayment("OBH-ABC123"),
    (error) =>
      isOBHPaymentsError(error) &&
      error.code === "TIMEOUT" &&
      error.retryable === true
  )
})

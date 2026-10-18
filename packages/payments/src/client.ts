import { OBHPaymentsError } from "./errors.js"
import type {
  APIErrorEnvelope,
  OBHPaymentsOptions,
  Payment,
  PaymentStatus,
  StartPaymentInput,
} from "./types.js"

const SDK_VERSION = "0.1.0"
const DEFAULT_TIMEOUT_MS = 15_000
const VALID_STATUSES = new Set<PaymentStatus>([
  "pending",
  "completed",
  "failed",
  "cancelled",
  "expired",
])

function invalidArgument(message: string) {
  return new OBHPaymentsError(message, { code: "INVALID_ARGUMENT" })
}

function normalizeBaseUrl(input: string) {
  let url: URL

  try {
    url = new URL(input)
  } catch {
    throw invalidArgument("baseUrl must be an absolute URL.")
  }

  if (url.username || url.password || url.search || url.hash) {
    throw invalidArgument("baseUrl cannot contain credentials, query, or hash.")
  }

  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw invalidArgument(
      "baseUrl must use HTTPS except for localhost development."
    )
  }

  const base = `${url.origin}${url.pathname}`.replace(/\/+$/, "")
  return base.endsWith("/api/v1") ? base : `${base}/api/v1`
}

function isPayment(value: unknown): value is Payment {
  if (!value || typeof value !== "object") {
    return false
  }

  const payment = value as Partial<Payment>

  return (
    typeof payment.id === "string" &&
    typeof payment.reference === "string" &&
    typeof payment.service === "string" &&
    typeof payment.amount === "string" &&
    typeof payment.currency === "string" &&
    (payment.environment === "test" || payment.environment === "live") &&
    typeof payment.status === "string" &&
    VALID_STATUSES.has(payment.status as PaymentStatus) &&
    typeof payment.description === "string" &&
    typeof payment.createdAt === "string"
  )
}

function validateStartInput(input: StartPaymentInput) {
  if (!input.externalOrderId || input.externalOrderId.length > 191) {
    throw invalidArgument("externalOrderId must be 1–191 characters.")
  }

  if (
    !/^\d{1,18}(?:\.\d{1,2})?$/.test(input.amount) ||
    /^0+(?:\.0{1,2})?$/.test(input.amount)
  ) {
    throw invalidArgument("amount must be a positive decimal string.")
  }

  if (input.currency !== undefined && input.currency !== "IRR") {
    throw invalidArgument("Only IRR is supported.")
  }

  if (!input.description.trim() || input.description.length > 500) {
    throw invalidArgument("description must be 1–500 characters.")
  }

  if (input.returnUrl !== undefined) {
    let url: URL
    try {
      url = new URL(input.returnUrl)
    } catch {
      throw invalidArgument("returnUrl must be an absolute URL.")
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw invalidArgument("returnUrl must use http or https.")
    }
  }

  if (input.metadata !== undefined) {
    if (
      !input.metadata ||
      typeof input.metadata !== "object" ||
      Array.isArray(input.metadata)
    ) {
      throw invalidArgument("metadata must be a JSON object.")
    }

    if (JSON.stringify(input.metadata).length > 8 * 1024) {
      throw invalidArgument("metadata cannot exceed 8 KB.")
    }
  }

  if (
    input.idempotencyKey !== undefined &&
    (!/^[\x21-\x7E]{1,191}$/.test(input.idempotencyKey) ||
      input.idempotencyKey.length > 191)
  ) {
    throw invalidArgument(
      "idempotencyKey must be 1–191 visible ASCII characters."
    )
  }
}

export class OBHPayments {
  readonly #secretKey: string
  readonly #apiBaseUrl: string
  readonly #timeoutMs: number
  readonly #fetch: typeof fetch

  constructor(options: OBHPaymentsOptions) {
    if (typeof window !== "undefined") {
      throw new Error(
        "@obh/payments is server-only and must not run in browser code."
      )
    }

    if (!options.secretKey?.startsWith("svc_")) {
      throw invalidArgument("secretKey must be an OBH service credential.")
    }

    if (
      options.timeoutMs !== undefined &&
      (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    ) {
      throw invalidArgument("timeoutMs must be a positive number.")
    }

    const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)

    if (typeof fetchImpl !== "function") {
      throw invalidArgument("A fetch implementation is required.")
    }

    this.#secretKey = options.secretKey
    this.#apiBaseUrl = normalizeBaseUrl(options.baseUrl)
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.#fetch = fetchImpl
  }

  async startPayment(input: StartPaymentInput): Promise<Payment> {
    validateStartInput(input)

    const idempotencyKey =
      input.idempotencyKey ?? `sdk_${globalThis.crypto.randomUUID()}`

    const body: Record<string, unknown> = {
      externalOrderId: input.externalOrderId,
      amount: input.amount,
      currency: input.currency ?? "IRR",
      description: input.description,
    }

    if (input.returnUrl !== undefined) {
      body.returnUrl = input.returnUrl
    }

    if (input.metadata !== undefined) {
      body.metadata = input.metadata
    }

    return this.#request("/payments", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    })
  }

  async getPayment(reference: string): Promise<Payment> {
    if (!reference || reference.length > 64) {
      throw invalidArgument("A valid payment reference is required.")
    }

    return this.#request(`/payments/${encodeURIComponent(reference)}`, {
      method: "GET",
    })
  }

  async #request(path: string, init: RequestInit): Promise<Payment> {
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.#timeoutMs)

    let response: Response

    try {
      response = await this.#fetch(`${this.#apiBaseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#secretKey}`,
          "Content-Type": "application/json",
          "User-Agent": `@obh/payments/${SDK_VERSION}`,
          ...init.headers,
        },
      })
    } catch (error) {
      if (timedOut) {
        throw new OBHPaymentsError(
          "The OBH API request timed out. Retrieve the payment status before retrying.",
          { code: "TIMEOUT", retryable: true, cause: error }
        )
      }

      throw new OBHPaymentsError("The OBH API could not be reached.", {
        code: "NETWORK_ERROR",
        retryable: true,
        cause: error,
      })
    } finally {
      clearTimeout(timeout)
    }

    const raw = await response.text()
    let payload: { data?: unknown } & APIErrorEnvelope = {}

    if (raw) {
      try {
        payload = JSON.parse(raw) as { data?: unknown } & APIErrorEnvelope
      } catch {
        throw new OBHPaymentsError(
          "The OBH API returned an invalid JSON response.",
          {
            code: "INVALID_RESPONSE",
            status: response.status,
            requestId: response.headers.get("x-request-id") ?? undefined,
          }
        )
      }
    }

    if (!response.ok) {
      const error = payload.error
      throw new OBHPaymentsError(
        error?.message ?? "The OBH API rejected the request.",
        {
          code: error?.code ?? "API_ERROR",
          status: response.status,
          requestId:
            error?.requestId ??
            response.headers.get("x-request-id") ??
            undefined,
          details: error?.details,
          retryable: response.status === 429 || response.status >= 500,
        }
      )
    }

    if (!isPayment(payload.data)) {
      throw new OBHPaymentsError(
        "The OBH API returned an unexpected payment shape.",
        {
          code: "INVALID_RESPONSE",
          status: response.status,
          requestId: response.headers.get("x-request-id") ?? undefined,
        }
      )
    }

    return payload.data
  }
}

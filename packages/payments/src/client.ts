import { OBHPaymentsError } from "./errors.js"
import type {
  APIErrorEnvelope,
  ListGatewaysOptions,
  OBHPaymentsOptions,
  Payment,
  PaymentGateway,
  PaymentReceipt,
  PaymentStatus,
  StartPaymentInput,
  VerifyReturnInput,
} from "./types.js"

const SDK_VERSION = "0.2.0"
const DEFAULT_BASE_URL = "https://obhco.ir/api/v1"
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

function isReceipt(value: unknown): value is PaymentReceipt {
  if (!value || typeof value !== "object") {
    return false
  }

  const receipt = value as Partial<PaymentReceipt>

  return (
    typeof receipt.orderNumber === "string" &&
    (receipt.traceNumber === null || typeof receipt.traceNumber === "string") &&
    (receipt.referenceNumber === null ||
      typeof receipt.referenceNumber === "string") &&
    (receipt.maskedCardNumber === null ||
      typeof receipt.maskedCardNumber === "string") &&
    (receipt.resultCode === null || typeof receipt.resultCode === "number") &&
    (receipt.resultMessage === null ||
      typeof receipt.resultMessage === "string")
  )
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
    isReceipt(payment.receipt) &&
    typeof payment.createdAt === "string" &&
    (payment.gateway === undefined || typeof payment.gateway === "string")
  )
}

function isGatewayList(value: unknown): value is PaymentGateway[] {
  return (
    Array.isArray(value) &&
    value.every((gateway) => {
      if (!gateway || typeof gateway !== "object") {
        return false
      }

      const candidate = gateway as Partial<PaymentGateway>

      return (
        typeof candidate.code === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.displayName === "string" &&
        (candidate.kind === "card" || candidate.kind === "installment") &&
        typeof candidate.requiresCustomerMobile === "boolean" &&
        typeof candidate.isDefault === "boolean"
      )
    })
  )
}

function validateStartInput(input: StartPaymentInput) {
  if (!input.externalOrderId || input.externalOrderId.length > 191) {
    throw invalidArgument("externalOrderId must be 1–191 characters.")
  }

  if (!/^[1-9]\d{0,17}$/.test(input.amount)) {
    throw invalidArgument(
      "amount must be a positive whole Rial integer string without decimals."
    )
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
    input.gateway !== undefined &&
    !/^[a-z0-9_-]{1,40}$/.test(input.gateway)
  ) {
    throw invalidArgument("gateway must be a code returned by listGateways().")
  }

  if (
    input.customerMobile !== undefined &&
    !/^(\+98|0098|98|0)?9\d{9}$/.test(input.customerMobile.trim())
  ) {
    throw invalidArgument(
      "customerMobile must be an Iranian mobile number such as 09121234567."
    )
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

function extractReturnReference(input: VerifyReturnInput): string {
  let raw: string | null | undefined

  if (input instanceof URL) {
    raw =
      input.searchParams.get("obh_reference") ??
      input.searchParams.get("reference")
  } else if (input instanceof URLSearchParams) {
    raw = input.get("obh_reference") ?? input.get("reference")
  } else if (typeof input === "string") {
    if (input.includes("://")) {
      try {
        const url = new URL(input)
        raw =
          url.searchParams.get("obh_reference") ??
          url.searchParams.get("reference")
      } catch {
        throw invalidArgument("Return URL could not be parsed.")
      }
    } else {
      const params = new URLSearchParams(
        input.startsWith("?") ? input.slice(1) : input
      )
      raw = params.get("obh_reference") ?? params.get("reference") ?? input
    }
  } else if (input && typeof input === "object") {
    const candidate = input.obh_reference ?? input.reference
    raw = Array.isArray(candidate) ? candidate[0] : candidate
  }

  const trimmed = raw?.trim()

  if (!trimmed || !/^OBH-[A-Z0-9]{8,44}$/.test(trimmed)) {
    throw invalidArgument(
      "Return parameters do not contain a valid payment reference."
    )
  }

  return trimmed
}

export class OBHPayments {
  readonly #secretKey: string
  readonly #apiBaseUrl: string
  readonly #simulator: boolean
  readonly #timeoutMs: number
  readonly #fetch: typeof fetch

  constructor(options: OBHPaymentsOptions) {
    if (typeof window !== "undefined") {
      throw new Error(
        "@obhco/payments is server-only and must not run in browser code."
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

    const envSimulator =
      typeof process !== "undefined" &&
      typeof process.env === "object" &&
      process.env?.OBH_SIMULATOR?.trim().toLowerCase() === "true"

    this.#secretKey = options.secretKey
    this.#apiBaseUrl =
      options.baseUrl !== undefined
        ? normalizeBaseUrl(options.baseUrl)
        : DEFAULT_BASE_URL
    this.#simulator = options.simulator ?? envSimulator
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.#fetch = fetchImpl
  }

  async startPayment(input: StartPaymentInput): Promise<Payment> {
    validateStartInput(input)

    const idempotencyKey =
      input.idempotencyKey ?? `sdk_${globalThis.crypto.randomUUID()}`

    const simulator = input.simulator ?? this.#simulator

    const body: Record<string, unknown> = {
      externalOrderId: input.externalOrderId,
      amount: input.amount,
      currency: input.currency ?? "IRR",
      description: input.description,
      simulator,
    }

    if (input.returnUrl !== undefined) {
      body.returnUrl = input.returnUrl
    }

    if (input.metadata !== undefined) {
      body.metadata = input.metadata
    }

    if (input.gateway !== undefined) {
      body.gateway = input.gateway
    }

    if (input.customerMobile !== undefined) {
      body.customer = { mobile: input.customerMobile.trim() }
    }

    return this.#request(
      "/payments",
      {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      },
      isPayment,
      "payment"
    )
  }

  async getPayment(reference: string): Promise<Payment> {
    if (!reference || reference.length > 64) {
      throw invalidArgument("A valid payment reference is required.")
    }

    return this.#request(
      `/payments/${encodeURIComponent(reference)}`,
      { method: "GET" },
      isPayment,
      "payment"
    )
  }

  /**
   * Lists the payment gateways OBH currently offers to this service, so a
   * checkout page can let the customer choose one (e.g. card or installments).
   * Pass the chosen `code` as `gateway` to `startPayment`.
   */
  async listGateways(options?: ListGatewaysOptions): Promise<PaymentGateway[]> {
    const simulator = options?.simulator ?? this.#simulator

    return this.#request(
      `/gateways?simulator=${simulator ? "true" : "false"}`,
      { method: "GET" },
      isGatewayList,
      "gateway list"
    )
  }

  /**
   * Parses the customer's return URL or query parameters after the gateway
   * redirect and retrieves the server-verified payment record from OBH.
   *
   * Never trust query string `status` flags directly; always use the returned
   * `Payment` object (`payment.status === "completed"` and `payment.receipt`).
   */
  async verifyReturn(
    input: VerifyReturnInput,
    options?: { expectedOrderId?: string; expectedAmount?: string }
  ): Promise<Payment> {
    const reference = extractReturnReference(input)
    const payment = await this.getPayment(reference)

    if (
      options?.expectedOrderId !== undefined &&
      payment.externalOrderId !== options.expectedOrderId
    ) {
      throw new OBHPaymentsError(
        "Returned payment does not match the expected external order ID.",
        { code: "ORDER_MISMATCH" }
      )
    }

    if (
      options?.expectedAmount !== undefined &&
      payment.amount !== options.expectedAmount
    ) {
      throw new OBHPaymentsError(
        "Returned payment amount does not match the expected amount.",
        { code: "AMOUNT_MISMATCH" }
      )
    }

    return payment
  }

  async #request<T>(
    path: string,
    init: RequestInit,
    isExpected: (value: unknown) => value is T,
    shapeName: string
  ): Promise<T> {
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
          "User-Agent": `@obhco/payments/${SDK_VERSION}`,
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

    if (!isExpected(payload.data)) {
      throw new OBHPaymentsError(
        `The OBH API returned an unexpected ${shapeName} shape.`,
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

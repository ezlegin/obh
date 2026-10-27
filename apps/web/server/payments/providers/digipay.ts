import { randomUUID } from "node:crypto"

import {
  PaymentProviderError,
  type CheckoutSession,
  type CheckoutSessionInput,
  type PaymentProviderAdapter,
  type ProviderEnvironmentValue,
  type VerifyPaymentInput,
  type VerifyPaymentResult,
} from "./types"

export const DIGIPAY_PROVIDER_CODE = "digipay"
export const DIGIPAY_PROVIDER_NAME = "Digipay (Installments / BNPL)"

const DEFAULT_DIGIPAY_BASE_URL = "https://api.mydigipay.com/digipay/api"
const DIGIPAY_TIMEOUT_MS = 15_000
const DIGIPAY_VERSION_HEADER = "2022-02-02"
/** `type=11` covers every payment tool on the Unified Payment Gateway (UPG). */
const DIGIPAY_UPG_TICKET_TYPE = 11

/**
 * Purchase `type` values Digipay posts back in the payment result and expects
 * again on `purchases/verify?type=`.
 */
export const DIGIPAY_PURCHASE_TYPES: Record<number, string> = {
  0: "IPG",
  5: "CREDIT",
  11: "WALLET",
  13: "BNPL",
  24: "CREDIT-CARD",
}

/** Business error codes from the Digipay UPG guide (HTTP 422 bodies). */
export const DIGIPAY_RESULT_CODES: Record<
  number,
  { message: string; retryable: boolean }
> = {
  0: { message: "Operation succeeded.", retryable: false },
  1054: { message: "Input data is incorrect.", retryable: false },
  9000: { message: "Purchase was not found.", retryable: false },
  9001: { message: "Payment token is invalid.", retryable: false },
  9003: { message: "Purchase has expired.", retryable: false },
  9004: { message: "Purchase is still in progress.", retryable: true },
  9005: { message: "Purchase cannot be paid.", retryable: false },
  9006: {
    message: "Could not communicate with the payment gateway.",
    retryable: true,
  },
  9007: { message: "Purchase was not completed.", retryable: false },
  9008: {
    message: "This purchase was already registered with different data.",
    retryable: false,
  },
  9009: {
    message: "The purchase verification window has passed.",
    retryable: false,
  },
  9010: { message: "Purchase verification failed.", retryable: false },
  9011: {
    message: "Purchase verification result is unknown.",
    retryable: true,
  },
  9012: {
    message: "Purchase state is not valid for this request.",
    retryable: false,
  },
  9030: {
    message: "A mobile number is required for registered users.",
    retryable: false,
  },
  9031: {
    message: "A ticket cannot be issued for this user.",
    retryable: false,
  },
}

export function describeDigipayCode(
  code: number | null | undefined,
  fallback?: string | null
) {
  if (fallback && fallback.trim()) {
    return fallback.trim()
  }

  if (code !== null && code !== undefined && DIGIPAY_RESULT_CODES[code]) {
    return DIGIPAY_RESULT_CODES[code].message
  }

  return code !== null && code !== undefined
    ? `Digipay result code ${code}`
    : "Unspecified gateway response"
}

export function isDigipaySimulatorEnabled(): boolean {
  return true
}

export type DigipayConfigStatus = {
  providerCode: typeof DIGIPAY_PROVIDER_CODE
  providerName: typeof DIGIPAY_PROVIDER_NAME
  baseUrl: string
  liveConfigured: boolean
  usernameMasked: string | null
  clientIdMasked: string | null
  simulatorEnabled: boolean
}

function maskIdentifier(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length <= 4) {
    return "****"
  }
  return `${trimmed.slice(0, 2)}${"*".repeat(Math.min(6, trimmed.length - 4))}${trimmed.slice(-2)}`
}

function readBaseUrl() {
  return (
    process.env.DIGIPAY_BASE_URL?.trim() || DEFAULT_DIGIPAY_BASE_URL
  ).replace(/\/+$/, "")
}

export function getDigipayConfigStatus(): DigipayConfigStatus {
  const username = process.env.DIGIPAY_USERNAME?.trim()
  const password = process.env.DIGIPAY_PASSWORD?.trim()
  const clientId = process.env.DIGIPAY_CLIENT_ID?.trim()
  const clientSecret = process.env.DIGIPAY_CLIENT_SECRET?.trim()

  return {
    providerCode: DIGIPAY_PROVIDER_CODE,
    providerName: DIGIPAY_PROVIDER_NAME,
    baseUrl: readBaseUrl(),
    liveConfigured: Boolean(username && password && clientId && clientSecret),
    usernameMasked: maskIdentifier(username),
    clientIdMasked: maskIdentifier(clientId),
    simulatorEnabled: isDigipaySimulatorEnabled(),
  }
}

function getLiveCredentials() {
  const username = process.env.DIGIPAY_USERNAME?.trim()
  const password = process.env.DIGIPAY_PASSWORD?.trim()
  const clientId = process.env.DIGIPAY_CLIENT_ID?.trim()
  const clientSecret = process.env.DIGIPAY_CLIENT_SECRET?.trim()

  if (!username || !password || !clientId || !clientSecret) {
    throw new PaymentProviderError(
      "DIGIPAY_CREDENTIALS_MISSING",
      "Digipay credentials (DIGIPAY_USERNAME, DIGIPAY_PASSWORD, DIGIPAY_CLIENT_ID, DIGIPAY_CLIENT_SECRET) are not configured in server environment variables."
    )
  }

  return { username, password, clientId, clientSecret, baseUrl: readBaseUrl() }
}

function shouldSimulate(environment: ProviderEnvironmentValue): boolean {
  return environment === "TEST"
}

async function digipayFetch(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DIGIPAY_TIMEOUT_MS)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null

/** Test hook: forget the cached OAuth access token. */
export function resetDigipayTokenCache() {
  cachedAccessToken = null
}

/**
 * Logs in with the merchant's username/password (`grant_type=password`) and
 * caches the bearer token until shortly before `expires_in` elapses.
 */
async function getAccessToken(forceRefresh = false): Promise<string> {
  if (
    !forceRefresh &&
    cachedAccessToken &&
    cachedAccessToken.expiresAt > Date.now()
  ) {
    return cachedAccessToken.value
  }

  const { username, password, clientId, clientSecret, baseUrl } =
    getLiveCredentials()

  const form = new FormData()
  form.set("username", username)
  form.set("password", password)
  form.set("grant_type", "password")

  let response: Response
  try {
    response = await digipayFetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: form,
    })
  } catch {
    throw new PaymentProviderError(
      "DIGIPAY_NETWORK_ERROR",
      "Could not reach the Digipay login endpoint."
    )
  }

  if (!response.ok) {
    throw new PaymentProviderError(
      "DIGIPAY_AUTH_FAILED",
      `Digipay login failed with HTTP ${response.status}.`
    )
  }

  const data = (await response.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
  } | null

  if (!data?.access_token) {
    throw new PaymentProviderError(
      "DIGIPAY_INVALID_RESPONSE",
      "Digipay login did not return an access token."
    )
  }

  const lifetimeSeconds = Math.max(30, Number(data.expires_in ?? 300))
  cachedAccessToken = {
    value: data.access_token,
    expiresAt: Date.now() + (lifetimeSeconds - 30) * 1000,
  }

  return data.access_token
}

async function authorizedPost(path: string, body: unknown): Promise<Response> {
  const { baseUrl } = getLiveCredentials()

  const send = async (token: string) =>
    digipayFetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=UTF-8",
        Agent: "WEB",
        "Digipay-Version": DIGIPAY_VERSION_HEADER,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

  let response = await send(await getAccessToken())

  // An expired or revoked token returns 401; log in again once.
  if (response.status === 401) {
    response = await send(await getAccessToken(true))
  }

  return response
}

type DigipayResult = {
  status?: number | string
  message?: string | null
  title?: string | null
  level?: string | null
}

type DigipayTicketResponse = {
  result?: DigipayResult
  ticket?: string | null
  redirectUrl?: string | null
}

type DigipayVerifyResponse = {
  result?: DigipayResult
  trackingCode?: string | null
  providerId?: string | number | null
  rrn?: string | null
  maskedPan?: string | null
  pspName?: string | null
  fpName?: string | null
  amount?: string | number | null
  paymentGateway?: number | null
  additionalInfo?: Record<string, unknown> | null
}

export function normalizeIranianMobile(value: string | null | undefined) {
  const digits = value
    ?.trim()
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\s-]/g, "")

  if (!digits) {
    return null
  }

  const local = digits.startsWith("+98")
    ? `0${digits.slice(3)}`
    : digits.startsWith("0098")
      ? `0${digits.slice(4)}`
      : digits.startsWith("98") && digits.length === 12
        ? `0${digits.slice(2)}`
        : digits

  return /^09\d{9}$/.test(local) ? local : null
}

function readString(value: unknown) {
  return value === undefined || value === null || value === ""
    ? null
    : String(value)
}

export const digipayPaymentAdapter: PaymentProviderAdapter = {
  code: DIGIPAY_PROVIDER_CODE,
  descriptor: {
    code: DIGIPAY_PROVIDER_CODE,
    name: DIGIPAY_PROVIDER_NAME,
    displayName: "خرید اقساطی با دیجی‌پی",
    description:
      "Buy now and pay later in installments with Digipay credit, or pay with a Digipay wallet or bank card.",
    kind: "installment",
    requiresCustomerMobile: true,
    minAmount: null,
  },
  supportedEnvironments: ["TEST", "LIVE"],

  isLiveConfigured() {
    return getDigipayConfigStatus().liveConfigured
  },

  async createCheckoutSession(
    input: CheckoutSessionInput
  ): Promise<CheckoutSession> {
    if (input.currency !== "IRR") {
      throw new PaymentProviderError(
        "CURRENCY_NOT_SUPPORTED",
        "Digipay only supports IRR."
      )
    }

    if (!/^[1-9]\d{0,17}$/.test(input.amount)) {
      throw new PaymentProviderError(
        "INVALID_AMOUNT",
        "Digipay requires a positive whole Rial integer amount."
      )
    }

    const cellNumber = normalizeIranianMobile(input.customerMobile)
    if (!cellNumber) {
      throw new PaymentProviderError(
        "CUSTOMER_MOBILE_REQUIRED",
        "Digipay requires the customer's mobile number (09xxxxxxxxx)."
      )
    }

    if (shouldSimulate(input.environment)) {
      const ticket = `digipay_sim_${randomUUID().replaceAll("-", "")}`
      return {
        providerSessionId: ticket,
        providerReference: null,
        checkoutUrl: `/pay/digipay/${encodeURIComponent(ticket)}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        resultCode: 0,
        resultMessage: "تیکت خرید با موفقیت ایجاد شد (شبیه‌ساز دیجی‌پی)",
        simulated: true,
      }
    }

    // A basket is mandatory for credit and BNPL purchases. OBH services sell
    // services, so each purchase is described as a single service item.
    const requestBody = {
      amount: Number(input.amount),
      cellNumber,
      providerId: input.gatewayOrderId,
      callbackUrl: input.callbackUrl,
      basketDetailsDto: {
        basketId: input.paymentReference,
        items: [
          {
            sellerId: "obh",
            supplierId: input.serviceSlug,
            productCode: input.serviceSlug,
            brand: "OBH",
            productType: 3,
            count: 1,
            categoryId: input.serviceSlug,
          },
        ],
      },
    }

    let response: Response
    try {
      response = await authorizedPost(
        `/tickets/business?type=${DIGIPAY_UPG_TICKET_TYPE}`,
        requestBody
      )
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        throw error
      }
      throw new PaymentProviderError(
        "DIGIPAY_NETWORK_ERROR",
        "Could not reach the Digipay ticket endpoint."
      )
    }

    const data = (await response
      .json()
      .catch(() => null)) as DigipayTicketResponse | null

    if (!data) {
      throw new PaymentProviderError(
        "DIGIPAY_INVALID_RESPONSE",
        `Digipay ticket request returned non-JSON status ${response.status}.`
      )
    }

    const resultCode = Number(data.result?.status ?? -1)
    const description = describeDigipayCode(resultCode, data.result?.message)

    if (!response.ok || resultCode !== 0 || !data.ticket || !data.redirectUrl) {
      throw new PaymentProviderError(
        `DIGIPAY_RES_${resultCode}`,
        description,
        resultCode
      )
    }

    return {
      providerSessionId: data.ticket,
      providerReference: null,
      checkoutUrl: data.redirectUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resultCode: 0,
      resultMessage: description,
      simulated: false,
    }
  },

  /**
   * `payload` is the POST body Digipay sent to the callback URL: `result`,
   * `trackingCode`, `providerId`, `amount`, `type`, and optional `rrn`.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const payload = input.payload ?? {}
    const ticket = input.providerSessionId
    const isSimulatedTicket = Boolean(ticket?.startsWith("digipay_sim_"))
    const environment =
      input.environment ?? (isSimulatedTicket ? "TEST" : "LIVE")
    const simulated = isSimulatedTicket || shouldSimulate(environment)

    const trackingCode =
      readString(payload.trackingCode) ?? input.providerReference
    const callbackResult = readString(payload.result)?.toUpperCase() ?? null
    const purchaseType =
      payload.type !== undefined && payload.type !== null
        ? Number(payload.type)
        : null
    const callbackProviderId = readString(payload.providerId)
    const callbackAmount = readString(payload.amount)

    const pending = (resultCode: number, resultMessage: string) =>
      ({
        status: "PENDING",
        providerReference: trackingCode ?? ticket ?? "",
        traceNumber: null,
        maskedCardNumber: null,
        resultCode,
        resultMessage,
        verifiedAmount: null,
        verifiedOrderId: null,
        verifiedAt: null,
        failureReason: null,
        metadata: {
          adapter: DIGIPAY_PROVIDER_CODE,
          simulated,
          environment,
          trackingCode,
          type: purchaseType,
        },
      }) satisfies VerifyPaymentResult

    const failed = (
      resultCode: number,
      reason: string,
      extra: Record<string, unknown> = {}
    ) =>
      ({
        status: "FAILED",
        providerReference:
          trackingCode ??
          `sim_fail_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        traceNumber: null,
        maskedCardNumber: null,
        resultCode,
        resultMessage: reason,
        verifiedAmount: callbackAmount,
        verifiedOrderId: callbackProviderId,
        verifiedAt: new Date(),
        failureReason: reason,
        metadata: {
          adapter: DIGIPAY_PROVIDER_CODE,
          simulated,
          environment,
          trackingCode,
          type: purchaseType,
          ...extra,
        },
      }) satisfies VerifyPaymentResult

    if (!callbackResult) {
      return pending(-1, "Awaiting Digipay payment result.")
    }

    if (callbackResult !== "SUCCESS") {
      return failed(9007, "پرداخت دیجی‌پی ناموفق بود یا توسط کاربر لغو شد.")
    }

    if (!trackingCode || purchaseType === null || Number.isNaN(purchaseType)) {
      return failed(
        1054,
        "Digipay callback is missing trackingCode or purchase type."
      )
    }

    // Per the UPG guide, check amount and providerId from the callback
    // against our own record before calling Verify.
    if (
      input.gatewayOrderId &&
      callbackProviderId &&
      callbackProviderId !== input.gatewayOrderId
    ) {
      return failed(1054, "Digipay callback providerId did not match.", {
        expectedOrderId: input.gatewayOrderId,
        callbackProviderId,
      })
    }

    if (
      input.expectedAmount &&
      callbackAmount &&
      callbackAmount !== input.expectedAmount
    ) {
      return failed(1054, "Digipay callback amount did not match.", {
        expectedAmount: input.expectedAmount,
        callbackAmount,
      })
    }

    if (simulated) {
      if (!isDigipaySimulatorEnabled()) {
        throw new PaymentProviderError(
          "DIGIPAY_SIMULATOR_DISABLED",
          "The Digipay test simulator is disabled in production."
        )
      }

      return {
        status: "COMPLETED",
        providerReference: trackingCode,
        traceNumber: readString(payload.rrn),
        maskedCardNumber: null,
        resultCode: 0,
        resultMessage: "خرید با موفقیت تایید شد (شبیه‌ساز دیجی‌پی)",
        verifiedAmount: input.expectedAmount ?? callbackAmount,
        verifiedOrderId: input.gatewayOrderId ?? callbackProviderId,
        verifiedAt: new Date(),
        failureReason: null,
        metadata: {
          adapter: DIGIPAY_PROVIDER_CODE,
          simulated: true,
          environment: "TEST",
          trackingCode,
          type: purchaseType,
          purchaseType: DIGIPAY_PURCHASE_TYPES[purchaseType] ?? null,
        },
      }
    }

    let response: Response
    try {
      response = await authorizedPost(
        `/purchases/verify?type=${purchaseType}`,
        {
          trackingCode,
          providerId: input.gatewayOrderId ?? callbackProviderId,
        }
      )
    } catch {
      // A network failure is not proof of failure; keep PENDING and retry.
      return pending(
        9011,
        "Temporary communication failure during Digipay verify; retry pending."
      )
    }

    const data = (await response
      .json()
      .catch(() => null)) as DigipayVerifyResponse | null

    if (!data) {
      return pending(
        9011,
        `Digipay verify returned non-JSON status ${response.status}.`
      )
    }

    const resultCode = Number(data.result?.status ?? -1)
    const description = describeDigipayCode(resultCode, data.result?.message)

    if (response.status >= 500 || DIGIPAY_RESULT_CODES[resultCode]?.retryable) {
      return pending(resultCode, description)
    }

    if (!response.ok || resultCode !== 0) {
      return failed(resultCode, description)
    }

    const verifiedAmount = readString(data.amount)
    const verifiedOrderId = readString(data.providerId)

    if (
      input.gatewayOrderId &&
      verifiedOrderId &&
      verifiedOrderId !== input.gatewayOrderId
    ) {
      return failed(resultCode, "Verified providerId did not match.", {
        expectedOrderId: input.gatewayOrderId,
        verifiedOrderId,
      })
    }

    if (
      input.expectedAmount &&
      verifiedAmount &&
      verifiedAmount !== input.expectedAmount
    ) {
      return failed(resultCode, "Verified amount did not match.", {
        expectedAmount: input.expectedAmount,
        verifiedAmount,
      })
    }

    return {
      status: "COMPLETED",
      providerReference: readString(data.trackingCode) ?? trackingCode,
      traceNumber: readString(data.rrn),
      maskedCardNumber: readString(data.maskedPan),
      resultCode,
      resultMessage: description,
      verifiedAmount,
      verifiedOrderId,
      verifiedAt: new Date(),
      failureReason: null,
      metadata: {
        adapter: DIGIPAY_PROVIDER_CODE,
        simulated: false,
        environment,
        trackingCode,
        type: purchaseType,
        purchaseType: DIGIPAY_PURCHASE_TYPES[purchaseType] ?? null,
        paymentGateway: data.paymentGateway ?? null,
        pspName: data.pspName ?? null,
        fpName: data.fpName ?? null,
        additionalInfo: data.additionalInfo ?? null,
      },
    }
  },
}

import { randomUUID } from "node:crypto"

import {
  PaymentProviderError,
  type CheckoutSession,
  type CheckoutSessionInput,
  type PaymentGatewayAdapter,
  type VerifyPaymentInput,
  type VerifyPaymentResult,
} from "../types.js"

export const ZARINPAL_PROVIDER_CODE = "zarinpal"
export const ZARINPAL_PROVIDER_NAME = "Zarinpal"

const ZARINPAL_PRODUCTION_HOST = "https://payment.zarinpal.com"
const ZARINPAL_SANDBOX_HOST = "https://sandbox.zarinpal.com"
const ZARINPAL_TIMEOUT_MS = 15_000

/** Result codes from the Zarinpal v4 payment gateway guide. */
export const ZARINPAL_RESULT_CODES: Record<
  number,
  { message: string; retryable: boolean }
> = {
  100: { message: "Operation succeeded.", retryable: false },
  101: { message: "Payment was already verified.", retryable: false },
  [-9]: { message: "Validation error in the request.", retryable: false },
  [-10]: {
    message: "Terminal IP or merchant ID is not valid.",
    retryable: false,
  },
  [-11]: { message: "Merchant ID is not active.", retryable: false },
  [-12]: {
    message: "Too many attempts; try again later.",
    retryable: true,
  },
  [-15]: { message: "Merchant terminal is suspended.", retryable: false },
  [-16]: {
    message: "Merchant account level is not sufficient.",
    retryable: false,
  },
  [-30]: {
    message: "Merchant is not allowed floating fee wages.",
    retryable: false,
  },
  [-50]: {
    message: "Paid amount differs from the verify amount.",
    retryable: false,
  },
  [-51]: { message: "Payment was not successful.", retryable: false },
  [-52]: { message: "Unexpected Zarinpal error.", retryable: true },
  [-53]: {
    message: "This authority does not belong to this merchant.",
    retryable: false,
  },
  [-54]: { message: "Authority is not valid.", retryable: false },
  [-55]: { message: "Transaction was not found.", retryable: false },
}

export function describeZarinpalCode(
  code: number | null | undefined,
  fallback?: string | null
) {
  if (code !== null && code !== undefined && ZARINPAL_RESULT_CODES[code]) {
    return ZARINPAL_RESULT_CODES[code].message
  }

  if (fallback && fallback.trim()) {
    return fallback.trim()
  }

  return code !== null && code !== undefined
    ? `Zarinpal result code ${code}`
    : "Unspecified gateway response"
}

/**
 * Server env names. `ZARRINPAL_MERCHANT_ID` (double R) is accepted too
 * because existing deployments were configured with that spelling.
 */
function readMerchantId() {
  return (
    process.env.ZARINPAL_MERCHANT_ID?.trim() ||
    process.env.ZARRINPAL_MERCHANT_ID?.trim() ||
    null
  )
}

/** `ZARINPAL_SANDBOX=true` sends LIVE payments to Zarinpal's sandbox. */
function isSandbox() {
  return /^(1|true|yes|on)$/i.test(process.env.ZARINPAL_SANDBOX?.trim() ?? "")
}

function readHost() {
  return isSandbox() ? ZARINPAL_SANDBOX_HOST : ZARINPAL_PRODUCTION_HOST
}

export type ZarinpalConfigStatus = {
  providerCode: typeof ZARINPAL_PROVIDER_CODE
  providerName: typeof ZARINPAL_PROVIDER_NAME
  host: string
  sandbox: boolean
  liveConfigured: boolean
  merchantIdMasked: string | null
}

function maskIdentifier(value: string | null): string | null {
  if (!value) {
    return null
  }
  if (value.length <= 8) {
    return "****"
  }
  return `${value.slice(0, 4)}${"*".repeat(6)}${value.slice(-4)}`
}

export function getZarinpalConfigStatus(): ZarinpalConfigStatus {
  const merchantId = readMerchantId()

  return {
    providerCode: ZARINPAL_PROVIDER_CODE,
    providerName: ZARINPAL_PROVIDER_NAME,
    host: readHost(),
    sandbox: isSandbox(),
    liveConfigured: Boolean(merchantId),
    merchantIdMasked: maskIdentifier(merchantId),
  }
}

function getMerchantId() {
  const merchantId = readMerchantId()

  if (!merchantId) {
    throw new PaymentProviderError(
      "ZARINPAL_CREDENTIALS_MISSING",
      "ZARINPAL_MERCHANT_ID is not configured in server environment variables."
    )
  }

  return merchantId
}

type ZarinpalResponse = {
  data?:
    | {
        code?: number
        message?: string
        authority?: string
        ref_id?: number | string
        card_pan?: string
        card_hash?: string
        fee_type?: string
        fee?: number
      }
    | unknown[]
  errors?: { code?: number; message?: string } | unknown[]
}

async function zarinpalPost(path: string, body: unknown) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ZARINPAL_TIMEOUT_MS)

  try {
    const response = await fetch(`${readHost()}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const json = (await response
      .json()
      .catch(() => null)) as ZarinpalResponse | null
    return { response, json }
  } finally {
    clearTimeout(timeout)
  }
}

/** Zarinpal returns `data` or `errors`; the other is an empty array. */
function readResult(json: ZarinpalResponse | null) {
  const data = json?.data && !Array.isArray(json.data) ? json.data : null
  const errors =
    json?.errors && !Array.isArray(json.errors) ? json.errors : null
  const code = Number(data?.code ?? errors?.code ?? Number.NaN)

  return {
    data,
    code: Number.isNaN(code) ? null : code,
    message: data?.message ?? errors?.message ?? null,
  }
}

export function getZarinpalStartPayUrl(authority: string) {
  return `${readHost()}/pg/StartPay/${encodeURIComponent(authority)}`
}

function readString(value: unknown) {
  return value === undefined || value === null || value === ""
    ? null
    : String(value)
}

export const zarinpalPaymentAdapter: PaymentGatewayAdapter = {
  code: ZARINPAL_PROVIDER_CODE,
  descriptor: {
    code: ZARINPAL_PROVIDER_CODE,
    name: ZARINPAL_PROVIDER_NAME,
    displayName: "پرداخت با زرین‌پال",
    description:
      "Pays the full amount with any Shetab bank card through the Zarinpal gateway.",
    kind: "card",
    requiresCustomerMobile: false,
    minAmount: "10000",
  },

  isConfigured() {
    return getZarinpalConfigStatus().liveConfigured
  },

  async createCheckoutSession(
    input: CheckoutSessionInput
  ): Promise<CheckoutSession> {
    if (input.currency !== "IRR") {
      throw new PaymentProviderError(
        "CURRENCY_NOT_SUPPORTED",
        "OBH sends Zarinpal amounts in IRR only."
      )
    }

    if (
      !/^[1-9]\d{0,17}$/.test(input.amount) ||
      BigInt(input.amount) < 10000n
    ) {
      throw new PaymentProviderError(
        "INVALID_AMOUNT",
        "Zarinpal requires a whole Rial amount of at least 10,000 R."
      )
    }

    const mobile = input.customerMobile?.trim() || undefined
    let result: Awaited<ReturnType<typeof zarinpalPost>>
    try {
      result = await zarinpalPost("/pg/v4/payment/request.json", {
        merchant_id: getMerchantId(),
        amount: Number(input.amount),
        currency: "IRR",
        description: input.description.slice(0, 500) || input.serviceSlug,
        callback_url: input.callbackUrl,
        metadata: {
          order_id: input.gatewayOrderId,
          ...(mobile ? { mobile } : {}),
        },
      })
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        throw error
      }
      throw new PaymentProviderError(
        "ZARINPAL_NETWORK_ERROR",
        "Could not reach the Zarinpal payment request endpoint."
      )
    }

    const { data, code, message } = readResult(result.json)
    const description = describeZarinpalCode(code, message)

    if (code !== 100 || !data?.authority) {
      throw new PaymentProviderError(
        `ZARINPAL_RES_${code ?? "UNKNOWN"}`,
        description,
        code ?? undefined
      )
    }

    return {
      providerSessionId: data.authority,
      providerReference: null,
      checkoutUrl: getZarinpalStartPayUrl(data.authority),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resultCode: 100,
      resultMessage: description,
    }
  },

  /**
   * `payload` is the callback query: `Authority` and `Status` (`OK`/`NOK`).
   * Verify is only called for `OK`.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const payload = input.payload ?? {}
    const authority =
      readString(payload.Authority) ?? input.providerSessionId ?? null
    const status = readString(payload.Status)?.toUpperCase() ?? null

    const base = {
      adapter: ZARINPAL_PROVIDER_CODE,
      authority,
    }

    const pending = (resultCode: number, resultMessage: string) =>
      ({
        status: "PENDING",
        providerReference: authority ?? "",
        traceNumber: null,
        maskedCardNumber: null,
        resultCode,
        resultMessage,
        verifiedAmount: null,
        verifiedOrderId: null,
        verifiedAt: null,
        failureReason: null,
        metadata: base,
      }) satisfies VerifyPaymentResult

    const failed = (
      resultCode: number,
      reason: string,
      extra: Record<string, unknown> = {}
    ) =>
      ({
        status: "FAILED",
        providerReference:
          authority ??
          `fail_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        traceNumber: null,
        maskedCardNumber: null,
        resultCode,
        resultMessage: reason,
        verifiedAmount: null,
        verifiedOrderId: null,
        verifiedAt: new Date(),
        failureReason: reason,
        metadata: { ...base, ...extra },
      }) satisfies VerifyPaymentResult

    if (!status) {
      return pending(-1, "Awaiting Zarinpal payment result.")
    }

    if (status !== "OK") {
      return failed(-51, "پرداخت زرین‌پال ناموفق بود یا توسط کاربر لغو شد.")
    }

    if (!authority) {
      return failed(-54, "Zarinpal callback is missing Authority.")
    }

    if (!input.expectedAmount) {
      return failed(-9, "Expected amount is required to verify with Zarinpal.")
    }

    let result: Awaited<ReturnType<typeof zarinpalPost>>
    try {
      result = await zarinpalPost("/pg/v4/payment/verify.json", {
        merchant_id: getMerchantId(),
        amount: Number(input.expectedAmount),
        authority,
      })
    } catch {
      // A network failure is not proof of failure; keep PENDING and retry.
      return pending(
        -52,
        "Temporary communication failure during Zarinpal verify; retry pending."
      )
    }

    if (!result.json) {
      return pending(
        -52,
        `Zarinpal verify returned non-JSON status ${result.response.status}.`
      )
    }

    const { data, code, message } = readResult(result.json)
    const description = describeZarinpalCode(code, message)

    if (
      result.response.status >= 500 ||
      code === null ||
      ZARINPAL_RESULT_CODES[code]?.retryable
    ) {
      return pending(code ?? -52, description)
    }

    if ((code !== 100 && code !== 101) || !data) {
      return failed(code, description)
    }

    const refId = readString(data.ref_id) ?? authority

    return {
      status: "COMPLETED",
      providerReference: refId,
      traceNumber: refId,
      maskedCardNumber: readString(data.card_pan),
      resultCode: code,
      resultMessage: description,
      // Zarinpal verifies against the amount we send; -50 means a mismatch.
      verifiedAmount: input.expectedAmount,
      verifiedOrderId: input.gatewayOrderId ?? null,
      verifiedAt: new Date(),
      failureReason: null,
      metadata: {
        ...base,
        refId,
        cardHash: data.card_hash ?? null,
        feeType: data.fee_type ?? null,
        fee: data.fee ?? null,
      },
    }
  },

  parseCallback(payload) {
    const authority = payload.Authority?.trim() || null
    const status = payload.Status?.trim().toUpperCase() ?? ""
    const succeeded = status === "OK"

    return {
      sessionId: authority,
      gatewayOrderId: null,
      outcome: succeeded ? "verify" : "failed",
      resultCode: succeeded ? 100 : -51,
      resultText: succeeded
        ? "Zarinpal reported OK; awaiting verify."
        : "پرداخت زرین‌پال ناموفق بود یا توسط کاربر لغو شد.",
      providerReference: null,
      maskedCardNumber: null,
      payload: { Authority: authority, Status: status },
    }
  },
}

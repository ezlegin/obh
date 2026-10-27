import { createCipheriv, createDecipheriv, randomUUID } from "node:crypto"

import {
  PaymentProviderError,
  type CheckoutSession,
  type CheckoutSessionInput,
  type PaymentProviderAdapter,
  type ProviderEnvironmentValue,
  type VerifyPaymentInput,
  type VerifyPaymentResult,
} from "./types"

export const SADAD_PROVIDER_CODE = "sadad"
export const SADAD_PROVIDER_NAME = "Sadad (Bank Melli Iran)"

const DEFAULT_SADAD_BASE_URL = "https://sadad.shaparak.ir"
const SADAD_TIMEOUT_MS = 15_000

/**
 * Known Sadad IPG `PaymentRequest` and `Verify` response codes from
 * Sadad Electronic Payment Company "Purchase Process Implementation Guide" v1.10.
 */
export const SADAD_RESPONSE_CODES: Record<
  number,
  { message: string; retryable: boolean }
> = {
  0: { message: "Operation succeeded.", retryable: false },
  [-1]: {
    message: "Parameters are incorrect or transaction does not exist.",
    retryable: false,
  },
  3: { message: "Invalid or inactive merchant.", retryable: false },
  23: { message: "Inactive or invalid merchant.", retryable: false },
  58: {
    message: "Transaction not permitted for the terminal.",
    retryable: false,
  },
  61: {
    message: "Transaction amount exceeds the allowed limit.",
    retryable: false,
  },
  100: {
    message: "Duplicate verification request; previously verified.",
    retryable: false,
  },
  101: {
    message: "Transaction verification validity period has expired.",
    retryable: false,
  },
  1000: {
    message: "Incorrect sequence of submitted parameters.",
    retryable: false,
  },
  1001: { message: "Incorrect payment parameters.", retryable: false },
  1002: { message: "Gateway system error.", retryable: true },
  1003: { message: "Merchant IP address is incorrect.", retryable: false },
  1004: { message: "Merchant identifier is incorrect.", retryable: false },
  1005: { message: "Gateway access error; retry later.", retryable: true },
  1006: { message: "Gateway system error.", retryable: true },
  1011: {
    message: "Duplicate request or duplicate OrderId.",
    retryable: false,
  },
  1012: {
    message: "Merchant credentials, timestamp, or terminal key is incorrect.",
    retryable: false,
  },
  1015: {
    message: "Unknown error from the processing center.",
    retryable: true,
  },
  1017: {
    message: "Amount exceeds configured merchant limit.",
    retryable: false,
  },
  1018: { message: "Server date/time discrepancy.", retryable: false },
  1019: {
    message: "SHETAB card network payment is not enabled for this merchant.",
    retryable: false,
  },
  1020: { message: "Merchant is deactivated.", retryable: false },
  1023: { message: "Invalid merchant ReturnUrl.", retryable: false },
  1024: { message: "Invalid merchant timestamp.", retryable: false },
  1025: {
    message: "Invalid transaction signature (SignData).",
    retryable: false,
  },
  1026: { message: "Invalid transaction OrderId.", retryable: false },
  1027: { message: "Invalid MerchantId.", retryable: false },
  1028: { message: "Invalid TerminalId.", retryable: false },
  1029: {
    message: "Request IP is not in the registered IP range.",
    retryable: false,
  },
  1030: {
    message: "Payment domain is not among registered domains.",
    retryable: false,
  },
  1031: { message: "Payment time limit expired.", retryable: false },
  1032: {
    message: "Card is not permitted for this merchant.",
    retryable: false,
  },
  1033: {
    message: "Payment disabled due to merchant site issue.",
    retryable: false,
  },
  1036: { message: "Missing or invalid additional data.", retryable: false },
  1037: {
    message: "Merchant or terminal details are incorrect.",
    retryable: false,
  },
  1040: { message: "Supplied identifier is invalid.", retryable: false },
  1053: {
    message: "Invalid request from merchant; verify merchant information.",
    retryable: false,
  },
  1055: { message: "Invalid input value.", retryable: false },
  1056: {
    message: "Gateway temporarily unavailable; retry later.",
    retryable: true,
  },
  1058: {
    message: "Internet payment service unavailable; retry later.",
    retryable: true,
  },
  1061: {
    message: "Error generating unique code (possible browser Back navigation).",
    retryable: false,
  },
  1064: { message: "Please retry the request.", retryable: true },
  1065: {
    message: "Communication failure; retry after a short delay.",
    retryable: true,
  },
  1066: {
    message: "Payment service temporarily disabled.",
    retryable: true,
  },
  1068: {
    message: "Temporary outage during maintenance.",
    retryable: true,
  },
  1072: {
    message: "Error processing optional merchant parameters.",
    retryable: false,
  },
  1101: { message: "Invalid transaction amount.", retryable: false },
  1103: { message: "Invalid payment token.", retryable: false },
  1104: { message: "Invalid payment-splitting data.", retryable: false },
  1105: {
    message: "Transaction was returned because the time limit expired.",
    retryable: false,
  },
}

export function describeSadadCode(
  code: number | null | undefined,
  fallback?: string | null
) {
  if (fallback && fallback.trim()) {
    return fallback.trim()
  }

  if (code !== null && code !== undefined && SADAD_RESPONSE_CODES[code]) {
    return SADAD_RESPONSE_CODES[code].message
  }

  return code !== null && code !== undefined
    ? `Sadad response code ${code}`
    : "Unspecified gateway response"
}

function normalizeTripleDesKey(base64TerminalKey: string): Buffer {
  const raw = Buffer.from(base64TerminalKey.trim(), "base64")

  if (raw.length === 24) {
    return raw
  }

  if (raw.length === 16) {
    // 2-key 3DES (K1 || K2 || K1)
    return Buffer.concat([raw, raw.subarray(0, 8)])
  }

  if (raw.length > 24) {
    return raw.subarray(0, 24)
  }

  throw new PaymentProviderError(
    "SADAD_INVALID_KEY",
    "SADAD_TERMINAL_KEY must decode from Base64 to at least 16 or 24 bytes."
  )
}

/**
 * Encrypts plaintext using TripleDES (3DES) in ECB mode with PKCS7 padding
 * and returns Base64, as required by Sadad IPG for `SignData`.
 */
export function createSadadSignData(
  plaintext: string,
  base64TerminalKey: string
): string {
  const key = normalizeTripleDesKey(base64TerminalKey)
  const cipher = createCipheriv("des-ede3", key, null)
  cipher.setAutoPadding(true)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])

  return encrypted.toString("base64")
}

export function decryptSadadSignData(
  signDataBase64: string,
  base64TerminalKey: string
): string {
  const key = normalizeTripleDesKey(base64TerminalKey)
  const decipher = createDecipheriv("des-ede3", key, null)
  decipher.setAutoPadding(true)

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(signDataBase64, "base64")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export function createSadadPaymentRequestSignData(input: {
  terminalId: string
  orderId: string | number | bigint
  amount: string | number | bigint
  terminalKey: string
}): string {
  const plaintext = `${input.terminalId};${String(input.orderId)};${String(input.amount)}`
  return createSadadSignData(plaintext, input.terminalKey)
}

export function createSadadVerifySignData(
  token: string,
  terminalKey: string
): string {
  return createSadadSignData(token, terminalKey)
}

export function isSadadSimulatorEnabled(): boolean {
  return true
}

export type SadadConfigStatus = {
  providerCode: typeof SADAD_PROVIDER_CODE
  providerName: typeof SADAD_PROVIDER_NAME
  baseUrl: string
  requestEndpoint: string
  purchaseEndpoint: string
  verifyEndpoint: string
  liveConfigured: boolean
  merchantId: string | null
  terminalId: string | null
  merchantIdMasked: string | null
  terminalIdMasked: string | null
  terminalKeyPrefix: string | null
  terminalKeyConfigured: boolean
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

export function getSadadConfigStatus(): SadadConfigStatus {
  const baseUrl = (
    process.env.SADAD_BASE_URL?.trim() || DEFAULT_SADAD_BASE_URL
  ).replace(/\/+$/, "")
  const merchantId = process.env.SADAD_MERCHANT_ID?.trim()
  const terminalId = process.env.SADAD_TERMINAL_ID?.trim()
  const terminalKey = process.env.SADAD_TERMINAL_KEY?.trim()

  let keyValid = false
  if (terminalKey) {
    try {
      normalizeTripleDesKey(terminalKey)
      keyValid = true
    } catch {
      keyValid = false
    }
  }

  return {
    providerCode: SADAD_PROVIDER_CODE,
    providerName: SADAD_PROVIDER_NAME,
    baseUrl,
    requestEndpoint: `${baseUrl}/api/v0/Request/PaymentRequest`,
    purchaseEndpoint: `${baseUrl}/Purchase`,
    verifyEndpoint: `${baseUrl}/api/v0/Advice/Verify`,
    liveConfigured: Boolean(merchantId && terminalId && keyValid),
    merchantId: merchantId || null,
    terminalId: terminalId || null,
    merchantIdMasked: maskIdentifier(merchantId),
    terminalIdMasked: maskIdentifier(terminalId),
    terminalKeyPrefix: terminalKey ? `${terminalKey.slice(0, 6)}...` : null,
    terminalKeyConfigured: keyValid,
    simulatorEnabled: isSadadSimulatorEnabled(),
  }
}

function getLiveCredentials() {
  const merchantId = process.env.SADAD_MERCHANT_ID?.trim()
  const terminalId = process.env.SADAD_TERMINAL_ID?.trim()
  const terminalKey = process.env.SADAD_TERMINAL_KEY?.trim()
  const baseUrl = (
    process.env.SADAD_BASE_URL?.trim() || DEFAULT_SADAD_BASE_URL
  ).replace(/\/+$/, "")

  if (!merchantId || !terminalId || !terminalKey) {
    throw new PaymentProviderError(
      "SADAD_CREDENTIALS_MISSING",
      "Sadad credentials (SADAD_MERCHANT_ID, SADAD_TERMINAL_ID, SADAD_TERMINAL_KEY) are not configured in server environment variables."
    )
  }

  normalizeTripleDesKey(terminalKey)

  return { merchantId, terminalId, terminalKey, baseUrl }
}

function shouldSimulate(environment: ProviderEnvironmentValue): boolean {
  return environment === "TEST"
}

type SadadPaymentRequestResponse = {
  ResCode?: number | string
  Token?: string | null
  Description?: string | null
}

type SadadVerifyResponse = {
  ResCode?: number | string
  Amount?: number | string
  Description?: string | null
  RetrivalRefNo?: string | null
  SystemTraceNo?: string | null
  OrderId?: number | string
  TransactionDate?: string | null
  CardHolderFullName?: string | null
}

export const sadadPaymentAdapter: PaymentProviderAdapter = {
  code: SADAD_PROVIDER_CODE,
  descriptor: {
    code: SADAD_PROVIDER_CODE,
    name: SADAD_PROVIDER_NAME,
    displayName: "پرداخت با کارت بانکی (سداد)",
    description:
      "Pay in full with any Shetab bank card through Sadad (Bank Melli Iran).",
    kind: "card",
    requiresCustomerMobile: false,
    minAmount: null,
  },
  supportedEnvironments: ["TEST", "LIVE"],

  isLiveConfigured() {
    return getSadadConfigStatus().liveConfigured
  },

  async createCheckoutSession(
    input: CheckoutSessionInput
  ): Promise<CheckoutSession> {
    if (input.currency !== "IRR") {
      throw new PaymentProviderError(
        "CURRENCY_NOT_SUPPORTED",
        "Sadad IPG only supports IRR."
      )
    }

    if (!/^[1-9]\d{0,17}$/.test(input.amount)) {
      throw new PaymentProviderError(
        "INVALID_AMOUNT",
        "Sadad IPG requires a positive whole Rial integer amount."
      )
    }

    if (!/^\d+$/.test(input.gatewayOrderId)) {
      throw new PaymentProviderError(
        "INVALID_ORDER_ID",
        "Sadad IPG requires a numeric OrderId."
      )
    }

    if (shouldSimulate(input.environment)) {
      const token = `sadad_sim_${randomUUID().replaceAll("-", "")}`
      return {
        providerSessionId: token,
        providerReference: null,
        checkoutUrl: `/pay/sadad/${encodeURIComponent(token)}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        resultCode: 0,
        resultMessage: "درخواست تراکنش با موفقیت ثبت شد (شبیه‌ساز سداد)",
        simulated: true,
      }
    }

    const { merchantId, terminalId, terminalKey, baseUrl } =
      getLiveCredentials()

    const signData = createSadadPaymentRequestSignData({
      terminalId,
      orderId: input.gatewayOrderId,
      amount: input.amount,
      terminalKey,
    })

    const requestBody = {
      MerchantId: merchantId,
      TerminalId: terminalId,
      Amount: Number(input.amount),
      OrderId: Number(input.gatewayOrderId),
      LocalDateTime: new Date().toISOString(),
      ReturnUrl: input.callbackUrl,
      SignData: signData,
      AdditionalData: input.paymentReference,
      ApplicationName: "OBH",
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SADAD_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${baseUrl}/api/v0/Request/PaymentRequest`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })
    } catch {
      throw new PaymentProviderError(
        "SADAD_NETWORK_ERROR",
        "Could not reach Sadad PaymentRequest endpoint."
      )
    } finally {
      clearTimeout(timeout)
    }

    let data: SadadPaymentRequestResponse
    try {
      data = (await response.json()) as SadadPaymentRequestResponse
    } catch {
      throw new PaymentProviderError(
        "SADAD_INVALID_RESPONSE",
        `Sadad PaymentRequest returned non-JSON status ${response.status}.`
      )
    }

    const resCode = Number(data.ResCode ?? -1)
    const description = describeSadadCode(resCode, data.Description)

    if (resCode !== 0 || !data.Token) {
      throw new PaymentProviderError(
        `SADAD_RES_${resCode}`,
        description,
        resCode
      )
    }

    const purchaseUrl = new URL(`${baseUrl}/Purchase`)
    purchaseUrl.searchParams.set("token", data.Token)

    return {
      providerSessionId: data.Token,
      providerReference: null,
      checkoutUrl: purchaseUrl.toString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resultCode: 0,
      resultMessage: description,
      simulated: false,
    }
  },

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const token = input.providerSessionId
    if (!token) {
      throw new PaymentProviderError(
        "INVALID_VERIFICATION_INPUT",
        "A Sadad transaction token (providerSessionId) is required for Verify."
      )
    }

    const isSimulatedToken = token.startsWith("sadad_sim_")
    const environment =
      input.environment ?? (isSimulatedToken ? "TEST" : "LIVE")

    if (isSimulatedToken || shouldSimulate(environment)) {
      if (!isSadadSimulatorEnabled()) {
        throw new PaymentProviderError(
          "SADAD_SIMULATOR_DISABLED",
          "The Sadad test simulator is disabled in production."
        )
      }

      const outcome = input.payload?.outcome
      const callbackResCode =
        input.payload?.ResCode !== undefined
          ? Number(input.payload.ResCode)
          : outcome === "success"
            ? 0
            : outcome === "failure"
              ? 1002
              : undefined

      const maskedCardNumber =
        typeof input.payload?.PrimaryAccNo === "string"
          ? input.payload.PrimaryAccNo
          : "603799******1234"

      if (callbackResCode === 0 || outcome === "success") {
        const retrievalRefNo =
          typeof input.payload?.RetrivalRefNo === "string"
            ? input.payload.RetrivalRefNo
            : `${Date.now().toString().slice(-12)}`
        const systemTraceNo =
          typeof input.payload?.SystemTraceNo === "string"
            ? input.payload.SystemTraceNo
            : `${Math.floor(100000 + Math.random() * 900000)}`

        return {
          status: "COMPLETED",
          providerReference: retrievalRefNo,
          traceNumber: systemTraceNo,
          maskedCardNumber,
          resultCode: 0,
          resultMessage: "عملیات با موفقیت انجام شد (شبیه‌ساز سداد)",
          verifiedAmount: input.expectedAmount ?? null,
          verifiedOrderId: input.gatewayOrderId ?? null,
          verifiedAt: new Date(),
          failureReason: null,
          metadata: {
            adapter: SADAD_PROVIDER_CODE,
            simulated: true,
            environment: "TEST",
            ResCode: 0,
            RetrivalRefNo: retrievalRefNo,
            SystemTraceNo: systemTraceNo,
            PrimaryAccNo: maskedCardNumber,
          },
        }
      }

      if (callbackResCode !== undefined || outcome === "failure") {
        const failedCode =
          callbackResCode && callbackResCode !== 0 ? callbackResCode : -1
        const reason = describeSadadCode(
          failedCode,
          typeof input.payload?.Description === "string"
            ? input.payload.Description
            : "تراکنش ناموفق یا لغو شده توسط کاربر (شبیه‌ساز سداد)"
        )

        return {
          status: "FAILED",
          providerReference:
            input.providerReference ??
            `sim_fail_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
          traceNumber: null,
          maskedCardNumber: null,
          resultCode: failedCode,
          resultMessage: reason,
          verifiedAmount: null,
          verifiedOrderId: input.gatewayOrderId ?? null,
          verifiedAt: new Date(),
          failureReason: reason,
          metadata: {
            adapter: SADAD_PROVIDER_CODE,
            simulated: true,
            environment: "TEST",
            ResCode: failedCode,
          },
        }
      }

      return {
        status: "PENDING",
        providerReference: input.providerReference ?? token,
        traceNumber: null,
        maskedCardNumber: null,
        resultCode: -1,
        resultMessage: "Awaiting customer callback.",
        verifiedAmount: null,
        verifiedOrderId: input.gatewayOrderId ?? null,
        verifiedAt: null,
        failureReason: null,
        metadata: {
          adapter: SADAD_PROVIDER_CODE,
          simulated: true,
          environment: "TEST",
        },
      }
    }

    const { terminalKey, baseUrl } = getLiveCredentials()
    const signData = createSadadVerifySignData(token, terminalKey)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SADAD_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${baseUrl}/api/v0/Advice/Verify`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Token: token,
          SignData: signData,
        }),
      })
    } catch {
      // Per Sadad guide §8.4: network/timeout on Verify is NOT proof of failure;
      // leave payment PENDING so Verify can be retried within the 15-minute window.
      return {
        status: "PENDING",
        providerReference: input.providerReference ?? token,
        traceNumber: null,
        maskedCardNumber:
          typeof input.payload?.PrimaryAccNo === "string"
            ? input.payload.PrimaryAccNo
            : null,
        resultCode: 1065,
        resultMessage:
          "Temporary communication failure during Sadad Verify; retry pending.",
        verifiedAmount: null,
        verifiedOrderId: null,
        verifiedAt: null,
        failureReason: null,
        metadata: {
          adapter: SADAD_PROVIDER_CODE,
          simulated: false,
          environment,
          retryableVerifyError: true,
        },
      }
    } finally {
      clearTimeout(timeout)
    }

    let data: SadadVerifyResponse
    try {
      data = (await response.json()) as SadadVerifyResponse
    } catch {
      return {
        status: "PENDING",
        providerReference: input.providerReference ?? token,
        traceNumber: null,
        maskedCardNumber: null,
        resultCode: 1002,
        resultMessage: `Sadad Verify returned non-JSON status ${response.status}.`,
        verifiedAmount: null,
        verifiedOrderId: null,
        verifiedAt: null,
        failureReason: null,
        metadata: {
          adapter: SADAD_PROVIDER_CODE,
          simulated: false,
          environment,
          httpStatus: response.status,
        },
      }
    }

    const resCode = Number(data.ResCode ?? -1)
    const description = describeSadadCode(resCode, data.Description)
    const verifiedAmount =
      data.Amount !== undefined && data.Amount !== null
        ? String(data.Amount)
        : null
    const verifiedOrderId =
      data.OrderId !== undefined && data.OrderId !== null
        ? String(data.OrderId)
        : null
    const retrievalRefNo = data.RetrivalRefNo
      ? String(data.RetrivalRefNo)
      : (input.providerReference ?? token)
    const systemTraceNo = data.SystemTraceNo ? String(data.SystemTraceNo) : null
    const maskedCardNumber =
      typeof input.payload?.PrimaryAccNo === "string"
        ? input.payload.PrimaryAccNo
        : null

    // ResCode 0 = verified; ResCode 100 = duplicate Verify (previously verified)
    if (resCode === 0 || resCode === 100) {
      if (
        input.gatewayOrderId &&
        verifiedOrderId &&
        verifiedOrderId !== input.gatewayOrderId
      ) {
        return {
          status: "FAILED",
          providerReference: retrievalRefNo,
          traceNumber: systemTraceNo,
          maskedCardNumber,
          resultCode: resCode,
          resultMessage:
            "Verified OrderId from Sadad did not match expected gatewayOrderId.",
          verifiedAmount,
          verifiedOrderId,
          verifiedAt: new Date(),
          failureReason: "OrderId mismatch on Sadad Verify.",
          metadata: {
            adapter: SADAD_PROVIDER_CODE,
            simulated: false,
            environment,
            expectedOrderId: input.gatewayOrderId,
            verifiedOrderId,
          },
        }
      }

      if (
        input.expectedAmount &&
        verifiedAmount &&
        verifiedAmount !== input.expectedAmount
      ) {
        return {
          status: "FAILED",
          providerReference: retrievalRefNo,
          traceNumber: systemTraceNo,
          maskedCardNumber,
          resultCode: resCode,
          resultMessage:
            "Verified Amount from Sadad did not match expected payment amount.",
          verifiedAmount,
          verifiedOrderId,
          verifiedAt: new Date(),
          failureReason: "Amount mismatch on Sadad Verify.",
          metadata: {
            adapter: SADAD_PROVIDER_CODE,
            simulated: false,
            environment,
            expectedAmount: input.expectedAmount,
            verifiedAmount,
          },
        }
      }

      return {
        status: "COMPLETED",
        providerReference: retrievalRefNo,
        traceNumber: systemTraceNo,
        maskedCardNumber,
        resultCode: resCode,
        resultMessage: description,
        verifiedAmount,
        verifiedOrderId,
        verifiedAt: new Date(),
        failureReason: null,
        metadata: {
          adapter: SADAD_PROVIDER_CODE,
          simulated: false,
          environment,
          ResCode: resCode,
          RetrivalRefNo: retrievalRefNo,
          SystemTraceNo: systemTraceNo,
          TransactionDate: data.TransactionDate ?? null,
        },
      }
    }

    return {
      status: "FAILED",
      providerReference: retrievalRefNo,
      traceNumber: systemTraceNo,
      maskedCardNumber,
      resultCode: resCode,
      resultMessage: description,
      verifiedAmount,
      verifiedOrderId,
      verifiedAt: new Date(),
      failureReason: description,
      metadata: {
        adapter: SADAD_PROVIDER_CODE,
        simulated: false,
        environment,
        ResCode: resCode,
      },
    }
  },
}

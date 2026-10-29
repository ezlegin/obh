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

export const MELLAT_PROVIDER_CODE = "mellat"
export const MELLAT_PROVIDER_NAME = "Mellat (Behpardakht)"

export { MELLAT_STARTPAY_URL } from "./mellat-constants"

const MELLAT_SOAP_URL = "https://bpm.shaparak.ir/pgwchannel/services/pgw"
const MELLAT_TIMEOUT_MS = 15_000

/** Response codes from the Behpardakht IPG guide v1.29. */
export const MELLAT_RESULT_CODES: Record<
  number,
  { message: string; retryable: boolean }
> = {
  0: { message: "Operation succeeded.", retryable: false },
  11: { message: "Card number is not valid.", retryable: false },
  12: { message: "Insufficient balance.", retryable: false },
  13: { message: "Incorrect PIN.", retryable: false },
  17: { message: "Customer cancelled the transaction.", retryable: false },
  21: { message: "Merchant is not valid.", retryable: false },
  24: { message: "Merchant credentials are not valid.", retryable: false },
  25: { message: "Amount is not valid.", retryable: false },
  31: { message: "Response is not valid.", retryable: true },
  34: { message: "Transaction failed at the issuer.", retryable: false },
  41: { message: "Duplicate order ID.", retryable: false },
  42: { message: "Sale transaction was not found.", retryable: false },
  43: { message: "Transaction was already verified.", retryable: false },
  44: { message: "Verify request was not found.", retryable: false },
  45: { message: "Transaction was already settled.", retryable: false },
  46: { message: "Transaction was not settled.", retryable: false },
  47: { message: "Settle transaction was not found.", retryable: false },
  48: { message: "Transaction was reversed.", retryable: false },
  54: { message: "Reference transaction was not found.", retryable: false },
  55: { message: "Transaction is not valid.", retryable: false },
  61: { message: "Deposit failed.", retryable: false },
  62: {
    message: "Callback URL is outside the registered domain.",
    retryable: false,
  },
  111: { message: "Card issuer is not valid.", retryable: false },
  112: { message: "Card issuer switch error.", retryable: true },
  113: { message: "No response from the card issuer.", retryable: true },
  114: { message: "Card holder may not perform this.", retryable: false },
  415: { message: "Session has expired.", retryable: false },
  416: { message: "Error registering data.", retryable: true },
  417: { message: "Payer ID is not valid.", retryable: false },
  418: { message: "Customer data definition error.", retryable: false },
  419: { message: "Too many data entry attempts.", retryable: false },
  421: { message: "Server IP is not whitelisted.", retryable: false },
}

export function describeMellatCode(code: number | null | undefined) {
  if (code !== null && code !== undefined && MELLAT_RESULT_CODES[code]) {
    return MELLAT_RESULT_CODES[code].message
  }
  return code !== null && code !== undefined
    ? `Mellat result code ${code}`
    : "Unspecified gateway response"
}

export function isMellatSimulatorEnabled(): boolean {
  return true
}

function readCredentials() {
  const terminalId = process.env.BEHPARDAKHT_TERMINAL_ID?.trim()
  const userName = process.env.BEHPARDAKHT_USERNAME?.trim()
  const userPassword = process.env.BEHPARDAKHT_PASSWORD?.trim()

  return terminalId && userName && userPassword && /^\d+$/.test(terminalId)
    ? { terminalId, userName, userPassword }
    : null
}

// Behpardakht only accepts whitelisted Iranian IPs, so the SOAP calls go
// through a relay on an Iranian host (deploy/mellat-relay). The customer's
// browser still opens Behpardakht's own StartPay page.
function readSoapEndpoint() {
  const relayUrl = process.env.BEHPARDAKHT_RELAY_URL?.trim()
  const relaySecret =
    process.env.BEHPARDAKHT_RELAY_SECRET?.trim() ||
    process.env.SADAD_RELAY_SECRET?.trim()

  if (relayUrl && relaySecret) {
    return {
      url: relayUrl,
      headers: { "X-Relay-Secret": relaySecret } as Record<string, string>,
      relayed: true,
    }
  }
  return { url: MELLAT_SOAP_URL, headers: {}, relayed: false }
}

export type MellatConfigStatus = {
  providerCode: typeof MELLAT_PROVIDER_CODE
  providerName: typeof MELLAT_PROVIDER_NAME
  liveConfigured: boolean
  terminalIdMasked: string | null
  usernameMasked: string | null
  relayed: boolean
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

export function getMellatConfigStatus(): MellatConfigStatus {
  return {
    providerCode: MELLAT_PROVIDER_CODE,
    providerName: MELLAT_PROVIDER_NAME,
    liveConfigured: Boolean(readCredentials()),
    terminalIdMasked: maskIdentifier(process.env.BEHPARDAKHT_TERMINAL_ID),
    usernameMasked: maskIdentifier(process.env.BEHPARDAKHT_USERNAME),
    relayed: readSoapEndpoint().relayed,
    simulatorEnabled: isMellatSimulatorEnabled(),
  }
}

function getCredentials() {
  const credentials = readCredentials()
  if (!credentials) {
    throw new PaymentProviderError(
      "MELLAT_CREDENTIALS_MISSING",
      "BEHPARDAKHT_TERMINAL_ID, BEHPARDAKHT_USERNAME and BEHPARDAKHT_PASSWORD are not configured in server environment variables."
    )
  }
  return credentials
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function buildMellatEnvelope(
  operation: string,
  fields: Array<[string, string]>
) {
  const body = fields
    .map(([name, value]) => `<${name}>${escapeXml(value)}</${name}>`)
    .join("")
  return `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:int="http://interfaces.core.sw.bps.com/"><soapenv:Body><int:${operation}>${body}</int:${operation}></soapenv:Body></soapenv:Envelope>`
}

/** Reads the single `<return>` string every Behpardakht operation returns. */
export function parseMellatReturn(xml: string) {
  const match = /<return>([^<]*)<\/return>/.exec(xml)
  return match?.[1] !== undefined ? match[1].trim() : null
}

async function callMellat(
  operation: string,
  fields: Array<[string, string]>
): Promise<string> {
  const { terminalId, userName, userPassword } = getCredentials()
  const endpoint = readSoapEndpoint()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MELLAT_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '""',
        ...endpoint.headers,
      },
      body: buildMellatEnvelope(operation, [
        ["terminalId", terminalId],
        ["userName", userName],
        ["userPassword", userPassword],
        ...fields,
      ]),
      signal: controller.signal,
    })
    const text = await response.text()
    const result = parseMellatReturn(text)

    if (result === null) {
      throw new PaymentProviderError(
        "MELLAT_INVALID_RESPONSE",
        `Mellat ${operation} returned no result (HTTP ${response.status}).`
      )
    }
    return result
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      throw error
    }
    throw new PaymentProviderError(
      "MELLAT_NETWORK_ERROR",
      `Could not reach Mellat ${operation}.`
    )
  } finally {
    clearTimeout(timeout)
  }
}

/** `localDate` (YYYYMMDD) and `localTime` (HHMMSS) in Tehran time. */
export function mellatLocalDateTime(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  )
  return {
    localDate: `${parts.year}${parts.month}${parts.day}`,
    localTime: `${parts.hour}${parts.minute}${parts.second}`,
  }
}

function shouldSimulate(environment: ProviderEnvironmentValue): boolean {
  return environment === "TEST"
}

function readString(value: unknown) {
  return value === undefined || value === null || value === ""
    ? null
    : String(value)
}

function readCode(value: string) {
  const code = Number(value.split(",")[0])
  return Number.isNaN(code) ? -1 : code
}

export const mellatPaymentAdapter: PaymentProviderAdapter = {
  code: MELLAT_PROVIDER_CODE,
  descriptor: {
    code: MELLAT_PROVIDER_CODE,
    name: MELLAT_PROVIDER_NAME,
    displayName: "پرداخت با کارت بانکی (به‌پرداخت ملت)",
    description:
      "Pays the full amount with any Shetab bank card through Bank Mellat's Behpardakht gateway.",
    kind: "card",
    requiresCustomerMobile: false,
    minAmount: null,
  },
  supportedEnvironments: ["TEST", "LIVE"],

  isLiveConfigured() {
    return getMellatConfigStatus().liveConfigured
  },

  async createCheckoutSession(
    input: CheckoutSessionInput
  ): Promise<CheckoutSession> {
    if (input.currency !== "IRR") {
      throw new PaymentProviderError(
        "CURRENCY_NOT_SUPPORTED",
        "Mellat only supports IRR."
      )
    }

    if (!/^[1-9]\d{0,17}$/.test(input.amount)) {
      throw new PaymentProviderError(
        "INVALID_AMOUNT",
        "Mellat requires a positive whole Rial integer amount."
      )
    }

    // StartPay needs a POST with RefId, so the checkout URL is always an OBH
    // page: the simulator in TEST, an auto-submitting form in LIVE.
    if (shouldSimulate(input.environment)) {
      const refId = `mellat_sim_${randomUUID().replaceAll("-", "")}`
      return {
        providerSessionId: refId,
        providerReference: null,
        checkoutUrl: `/pay/mellat/${encodeURIComponent(refId)}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        resultCode: 0,
        resultMessage: "درخواست پرداخت ایجاد شد (شبیه‌ساز ملت)",
        simulated: true,
      }
    }

    const { localDate, localTime } = mellatLocalDateTime()
    const mobile = input.customerMobile?.trim()
    const result = await callMellat("bpPayRequest", [
      ["orderId", input.gatewayOrderId],
      ["amount", input.amount],
      ["localDate", localDate],
      ["localTime", localTime],
      ["additionalData", input.paymentReference],
      [
        "callBackUrl",
        process.env.BEHPARDAKHT_CALLBACK_URL?.trim() || input.callbackUrl,
      ],
      ["payerId", "0"],
      ...(mobile ? ([["mobileNo", mobile.replace(/^0/, "98")]] as const) : []),
    ] as Array<[string, string]>)

    const [rawCode, refId] = result.split(",")
    const code = Number(rawCode)

    if (code !== 0 || !refId) {
      throw new PaymentProviderError(
        `MELLAT_RES_${rawCode}`,
        describeMellatCode(code),
        Number.isNaN(code) ? undefined : code
      )
    }

    return {
      providerSessionId: refId.trim(),
      providerReference: null,
      checkoutUrl: `/pay/mellat/${encodeURIComponent(refId.trim())}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resultCode: 0,
      resultMessage: describeMellatCode(0),
      simulated: false,
    }
  },

  /**
   * `payload` is the callback POST: `RefId`, `ResCode`, `SaleOrderId`,
   * `SaleReferenceId` and `CardHolderPan`. A successful payment is verified
   * and then settled; unsettled payments are never credited by the bank.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const payload = input.payload ?? {}
    const refId = readString(payload.RefId) ?? input.providerSessionId
    const isSimulated = Boolean(refId?.startsWith("mellat_sim_"))
    const environment = input.environment ?? (isSimulated ? "TEST" : "LIVE")
    const simulated = isSimulated || shouldSimulate(environment)
    const resCode = readString(payload.ResCode)
    const saleOrderId = readString(payload.SaleOrderId)
    const saleReferenceId = readString(payload.SaleReferenceId)
    const maskedCard = readString(payload.CardHolderPan)

    const base = {
      adapter: MELLAT_PROVIDER_CODE,
      simulated,
      environment,
      refId,
      saleOrderId,
      saleReferenceId,
    }

    const pending = (resultCode: number, resultMessage: string) =>
      ({
        status: "PENDING",
        providerReference: saleReferenceId ?? refId ?? "",
        traceNumber: null,
        maskedCardNumber: maskedCard,
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
          saleReferenceId ??
          refId ??
          `sim_fail_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        traceNumber: null,
        maskedCardNumber: maskedCard,
        resultCode,
        resultMessage: reason,
        verifiedAmount: null,
        verifiedOrderId: saleOrderId,
        verifiedAt: new Date(),
        failureReason: reason,
        metadata: { ...base, ...extra },
      }) satisfies VerifyPaymentResult

    if (resCode === null) {
      return pending(-1, "Awaiting Mellat payment result.")
    }

    if (resCode !== "0") {
      const code = Number(resCode)
      return failed(
        Number.isNaN(code) ? -1 : code,
        code === 17
          ? "پرداخت توسط کاربر لغو شد."
          : describeMellatCode(Number.isNaN(code) ? null : code)
      )
    }

    if (!saleOrderId || !saleReferenceId || !/^\d+$/.test(saleReferenceId)) {
      return failed(
        -1,
        "Mellat callback is missing SaleOrderId or SaleReferenceId."
      )
    }

    if (input.gatewayOrderId && saleOrderId !== input.gatewayOrderId) {
      return failed(-1, "Mellat SaleOrderId did not match.", {
        expectedOrderId: input.gatewayOrderId,
      })
    }

    const completed = (resultCode: number, extra: Record<string, unknown>) =>
      ({
        status: "COMPLETED",
        providerReference: saleReferenceId,
        traceNumber: saleReferenceId,
        maskedCardNumber: maskedCard,
        resultCode,
        resultMessage: describeMellatCode(resultCode),
        // Behpardakht charges the amount registered in bpPayRequest.
        verifiedAmount: input.expectedAmount ?? null,
        verifiedOrderId: saleOrderId,
        verifiedAt: new Date(),
        failureReason: null,
        metadata: { ...base, ...extra },
      }) satisfies VerifyPaymentResult

    if (simulated) {
      if (!isMellatSimulatorEnabled()) {
        throw new PaymentProviderError(
          "MELLAT_SIMULATOR_DISABLED",
          "The Mellat test simulator is disabled."
        )
      }
      return completed(0, { simulated: true, environment: "TEST" })
    }

    const references: Array<[string, string]> = [
      ["orderId", saleOrderId],
      ["saleOrderId", saleOrderId],
      ["saleReferenceId", saleReferenceId],
    ]

    let verifyCode: number
    try {
      verifyCode = readCode(await callMellat("bpVerifyRequest", references))
    } catch {
      // Verify timed out or failed in transit: ask for the status instead.
      try {
        verifyCode = readCode(await callMellat("bpInquiryRequest", references))
      } catch {
        return pending(
          -1,
          "Temporary communication failure during Mellat verify; retry pending."
        )
      }
    }

    if (verifyCode !== 0 && verifyCode !== 43) {
      if (MELLAT_RESULT_CODES[verifyCode]?.retryable) {
        return pending(verifyCode, describeMellatCode(verifyCode))
      }
      return failed(verifyCode, describeMellatCode(verifyCode), {
        step: "verify",
      })
    }

    let settleCode: number
    try {
      settleCode = readCode(await callMellat("bpSettleRequest", references))
    } catch {
      // Verified but not settled: keep PENDING so a retry settles it
      // (verify then answers 43).
      return pending(
        verifyCode,
        "Mellat payment verified; settle failed in transit and will be retried."
      )
    }

    if (settleCode !== 0 && settleCode !== 45) {
      if (MELLAT_RESULT_CODES[settleCode]?.retryable) {
        return pending(settleCode, describeMellatCode(settleCode))
      }
      return failed(settleCode, describeMellatCode(settleCode), {
        step: "settle",
      })
    }

    return completed(settleCode, { verifyCode, settleCode })
  },
}

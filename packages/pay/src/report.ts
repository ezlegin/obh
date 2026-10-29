import { PayError } from "./errors.js"
import type { PaymentRecord } from "./store.js"

/**
 * Finance event contract between a service and OBH. The payload is a full
 * snapshot of one payment attempt, so OBH can upsert it by
 * `(service, reference)`; a missed, duplicated or reordered event never
 * leaves the books wrong, it only delays them until the next snapshot.
 */
export type PaymentSnapshot = {
  reference: string
  orderId: string
  attempt: number
  gateway: string
  gatewayOrderId: string
  /** Whole Rials as a digit string. */
  amount: string
  currency: "IRR"
  status: PaymentRecord["status"]
  environment: PaymentRecord["environment"]
  description: string
  providerReference: string | null
  traceNumber: string | null
  maskedCardNumber: string | null
  resultCode: number | null
  resultText: string | null
  installment: PaymentRecord["installment"]
  createdAt: string
  callbackReceivedAt: string | null
  completedAt: string | null
  failedAt: string | null
  /** Only present when the service opts in with `includeMetadata`. */
  metadata?: Record<string, unknown>
}

export type FinanceEvent = {
  type: "payment.snapshot"
  /** Stable per reference and status, so retries are deduplicated. */
  eventId: string
  sentAt: string
  data: PaymentSnapshot
}

export type ReporterOptions = {
  /** OBH origin, e.g. `https://obhco.ir`. */
  baseUrl: string
  /** Service credential in `keyId.secret` form. Server-side only. */
  secretKey: string
  timeoutMs?: number
  /** Send `metadata` with each snapshot. Off by default to keep PII out. */
  includeMetadata?: boolean
  fetch?: typeof fetch
}

export type PingResult = {
  ok: true
  service: { slug: string; name: string }
}

export function toSnapshot(
  record: PaymentRecord,
  includeMetadata = false
): PaymentSnapshot {
  const iso = (value: Date | null) => (value ? value.toISOString() : null)

  return {
    reference: record.reference,
    orderId: record.orderId,
    attempt: record.attempt,
    gateway: record.gateway,
    gatewayOrderId: record.gatewayOrderId,
    amount: record.amount,
    currency: record.currency,
    status: record.status,
    environment: record.environment,
    description: record.description,
    providerReference: record.providerReference,
    traceNumber: record.traceNumber,
    maskedCardNumber: record.maskedCardNumber,
    resultCode: record.resultCode,
    resultText: record.resultText,
    installment: record.installment,
    createdAt: record.createdAt.toISOString(),
    callbackReceivedAt: iso(record.callbackReceivedAt),
    completedAt: iso(record.completedAt),
    failedAt: iso(record.failedAt),
    ...(includeMetadata ? { metadata: record.metadata } : {}),
  }
}

export class FinanceReporter {
  private readonly baseUrl: string
  private readonly secretKey: string
  private readonly timeoutMs: number
  private readonly includeMetadata: boolean
  private readonly fetchImpl: typeof fetch

  constructor(options: ReporterOptions) {
    if (!options.baseUrl || !options.secretKey) {
      throw new PayError(
        "REPORT_FAILED",
        "Finance reporting needs both baseUrl and secretKey."
      )
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, "")
    this.secretKey = options.secretKey
    this.timeoutMs = options.timeoutMs ?? 8_000
    this.includeMetadata = options.includeMetadata ?? false
    this.fetchImpl = options.fetch ?? fetch
  }

  /** Sends one payment snapshot. Throws a `PayError` when OBH rejects it. */
  async sendPayment(record: PaymentRecord): Promise<void> {
    const event: FinanceEvent = {
      type: "payment.snapshot",
      eventId: `${record.reference}:${record.status}`,
      sentAt: new Date().toISOString(),
      data: toSnapshot(record, this.includeMetadata),
    }

    await this.request("POST", "/api/v1/finance/events", event, event.eventId)
  }

  /** Checks the credential and connectivity without sending any data. */
  async ping(): Promise<PingResult> {
    return (await this.request("GET", "/api/v1/finance/ping")) as PingResult
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    idempotencyKey?: string
  ) {
    let lastError: unknown

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.secretKey}`,
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        })

        if (response.ok) {
          return (await response.json().catch(() => ({}))) as unknown
        }

        // 4xx other than 429 will not succeed on retry.
        if (response.status < 500 && response.status !== 429) {
          const text = await response.text().catch(() => "")
          throw new PayError(
            "REPORT_FAILED",
            `OBH rejected the report (HTTP ${response.status}).`,
            { status: response.status, body: text.slice(0, 500) }
          )
        }

        lastError = new PayError(
          "REPORT_FAILED",
          `OBH was unavailable (HTTP ${response.status}).`,
          { status: response.status }
        )
      } catch (error) {
        if (error instanceof PayError && error.details?.status) {
          const status = Number(error.details.status)
          if (status < 500 && status !== 429) {
            throw error
          }
        }
        lastError = error
      } finally {
        clearTimeout(timer)
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }

    throw lastError instanceof PayError
      ? lastError
      : new PayError("REPORT_FAILED", "Could not reach OBH to report.")
  }
}

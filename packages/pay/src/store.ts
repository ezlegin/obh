import type { CheckoutRedirect } from "./types.js"

export type PaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"

export type PaymentEnvironment = "live" | "test"

export type InstallmentInfo = {
  /** Gateway purchase type, e.g. `BNPL` or `CREDIT`. */
  purchaseType: string
  count: number | null
}

/**
 * One payment attempt as the service stores it. A customer retrying the same
 * order creates a new record (a new `reference` and `attempt`), never a
 * mutation of a failed one.
 */
export type PaymentRecord = {
  /** Unique id of this attempt, e.g. `PAY-3F9A…`. */
  reference: string
  /** The service's own order id. */
  orderId: string
  /** 1 for the first attempt on `orderId`, then 2, 3, … */
  attempt: number
  gateway: string
  /** Digits-only number sent to the gateway; unique per gateway. */
  gatewayOrderId: string
  /** Whole Rials as a digit string. */
  amount: string
  currency: "IRR"
  description: string
  status: PaymentStatus
  environment: PaymentEnvironment
  returnUrl: string | null
  customerMobile: string | null
  metadata: Record<string, unknown>

  providerSessionId: string | null
  providerReference: string | null
  traceNumber: string | null
  maskedCardNumber: string | null
  resultCode: number | null
  resultText: string | null
  installment: InstallmentInfo | null
  redirect: CheckoutRedirect | null
  /** Sanitised gateway callback body, kept for audit and retried verifies. */
  callbackPayload: Record<string, unknown> | null

  createdAt: Date
  expiresAt: Date | null
  callbackReceivedAt: Date | null
  completedAt: Date | null
  failedAt: Date | null

  /** Last status OBH acknowledged. `null` until the first successful report. */
  reportedStatus: PaymentStatus | null
  reportedAt: Date | null
}

export type PaymentPatch = Partial<Omit<PaymentRecord, "reference">>

/**
 * Persistence the host application provides. Everything the package needs is
 * a handful of lookups and one compare-and-set, so it maps onto any SQL or
 * document database. `MemoryPaymentStore` is the reference implementation.
 */
export interface PaymentStore {
  /** Returns the next digits-only order number for `gateway`. */
  nextGatewayOrderId(gateway: string): Promise<string>
  insert(record: PaymentRecord): Promise<PaymentRecord>
  findByReference(reference: string): Promise<PaymentRecord | null>
  /** Attempts for one order, oldest first. */
  listByOrderId(orderId: string): Promise<PaymentRecord[]>
  findByGatewayOrderId(
    gateway: string,
    gatewayOrderId: string
  ): Promise<PaymentRecord | null>
  findBySessionId(
    gateway: string,
    sessionId: string
  ): Promise<PaymentRecord | null>
  /** Unconditional patch of fields that do not change `status`. */
  update(reference: string, patch: PaymentPatch): Promise<PaymentRecord>
  /**
   * Applies `patch` only while the stored status equals `from`. Returns the
   * updated record, or `null` when another request already moved it. This is
   * what keeps a double callback from completing a payment twice.
   */
  transition(
    reference: string,
    from: PaymentStatus,
    patch: PaymentPatch & { status: PaymentStatus }
  ): Promise<PaymentRecord | null>
  /** Pending payments created before `before`, oldest first. */
  listPending(before: Date, limit: number): Promise<PaymentRecord[]>
  /** Records whose `status` differs from `reportedStatus`. */
  listUnreported(limit: number): Promise<PaymentRecord[]>
}

/** In-process store for tests and local development. Not for production. */
export class MemoryPaymentStore implements PaymentStore {
  private readonly records = new Map<string, PaymentRecord>()
  private counter = 0

  async nextGatewayOrderId(): Promise<string> {
    this.counter += 1
    return String(Date.now()) + String(this.counter).padStart(3, "0")
  }

  async insert(record: PaymentRecord) {
    if (this.records.has(record.reference)) {
      throw new Error(`Payment ${record.reference} already exists.`)
    }
    this.records.set(record.reference, { ...record })
    return { ...record }
  }

  async findByReference(reference: string) {
    const record = this.records.get(reference)
    return record ? { ...record } : null
  }

  async listByOrderId(orderId: string) {
    return [...this.records.values()]
      .filter((record) => record.orderId === orderId)
      .sort((a, b) => a.attempt - b.attempt)
      .map((record) => ({ ...record }))
  }

  async findByGatewayOrderId(gateway: string, gatewayOrderId: string) {
    const found = [...this.records.values()].find(
      (record) =>
        record.gateway === gateway && record.gatewayOrderId === gatewayOrderId
    )
    return found ? { ...found } : null
  }

  async findBySessionId(gateway: string, sessionId: string) {
    const found = [...this.records.values()].find(
      (record) =>
        record.gateway === gateway && record.providerSessionId === sessionId
    )
    return found ? { ...found } : null
  }

  async update(reference: string, patch: PaymentPatch) {
    const current = this.records.get(reference)
    if (!current) {
      throw new Error(`Payment ${reference} was not found.`)
    }
    const next = { ...current, ...patch }
    this.records.set(reference, next)
    return { ...next }
  }

  async transition(
    reference: string,
    from: PaymentStatus,
    patch: PaymentPatch & { status: PaymentStatus }
  ) {
    const current = this.records.get(reference)
    if (!current || current.status !== from) {
      return null
    }
    const next = { ...current, ...patch }
    this.records.set(reference, next)
    return { ...next }
  }

  async listPending(before: Date, limit: number) {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.status === "pending" &&
          record.createdAt.getTime() < before.getTime()
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map((record) => ({ ...record }))
  }

  async listUnreported(limit: number) {
    return [...this.records.values()]
      .filter((record) => record.status !== record.reportedStatus)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map((record) => ({ ...record }))
  }
}

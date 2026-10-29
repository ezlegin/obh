import { randomBytes } from "node:crypto"

import { PayError } from "./errors.js"
import {
  digipayPaymentAdapter,
  mellatPaymentAdapter,
  sadadPaymentAdapter,
  zarinpalPaymentAdapter,
} from "./gateways/index.js"
import { FinanceReporter, type ReporterOptions } from "./report.js"
import type {
  InstallmentInfo,
  PaymentEnvironment,
  PaymentRecord,
  PaymentStatus,
  PaymentStore,
} from "./store.js"
import {
  PaymentProviderError,
  type CheckoutRedirect,
  type PaymentGatewayAdapter,
  type PaymentGatewayDescriptor,
} from "./types.js"

const BUILT_IN_ADAPTERS: PaymentGatewayAdapter[] = [
  sadadPaymentAdapter,
  zarinpalPaymentAdapter,
  mellatPaymentAdapter,
  digipayPaymentAdapter,
]

const INSTALLMENT_PURCHASE_TYPES = new Set(["BNPL", "CREDIT"])

export type PayConfig = {
  /** Short stable id of this service, e.g. `afarin`. Sent to gateways. */
  service: string
  store: PaymentStore
  /**
   * Public origin of this service, e.g. `https://afarinai.ir`. The bank
   * sends customers back to `${baseUrl}${callbackPath}`.
   */
  baseUrl: string
  /** Callback path template. `{gateway}` is replaced. */
  callbackPath?: string
  /**
   * Gateways to offer. Defaults to every built-in gateway that has
   * credentials in the environment.
   */
  gateways?: Array<string | PaymentGatewayAdapter>
  defaultGateway?: string
  /** `live` (default) or `test`. Sent to OBH so reports can separate them. */
  environment?: PaymentEnvironment
  /**
   * Finance reporting to OBH. Defaults to `OBH_BASE_URL` + `OBH_SERVICE_KEY`
   * from the environment; pass `false` to turn reporting off.
   */
  report?: ReporterOptions | false
  /** Minutes before a pending payment with no callback is expired. */
  pendingTtlMinutes?: number
  /** Called when reporting to OBH fails. Payments are never blocked by it. */
  onReportError?: (error: unknown, payment: PaymentRecord) => void
}

export type StartPaymentInput = {
  /** Your own order id. One order can have several attempts. */
  orderId: string
  /** Whole Rials, as a digit string or number. */
  amount: string | number
  description: string
  gateway?: string
  /** Where the customer lands after the callback is processed. */
  returnUrl?: string
  /** Required by installment gateways (Digipay): `09xxxxxxxxx`. */
  customerMobile?: string
  metadata?: Record<string, unknown>
}

export type StartedPayment = {
  payment: PaymentRecord
  /** Send the customer's browser here. */
  redirect: CheckoutRedirect
  /** True when an existing open session for the same order was reused. */
  reused: boolean
}

export type CallbackResult = {
  payment: PaymentRecord
  /** True when the payment was already final and nothing changed. */
  replayed: boolean
}

export type ReconcileSummary = {
  expired: number
  reverified: number
  reported: number
}

function createReference() {
  return `PAY-${randomBytes(8).toString("hex").toUpperCase()}`
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}

function installmentFrom(
  metadata: Record<string, unknown>
): InstallmentInfo | null {
  const purchaseType = metadata.purchaseType
  return typeof purchaseType === "string" &&
    INSTALLMENT_PURCHASE_TYPES.has(purchaseType)
    ? { purchaseType, count: null }
    : null
}

export class Pay {
  readonly store: PaymentStore
  private readonly config: PayConfig
  private readonly adapters = new Map<string, PaymentGatewayAdapter>()
  private readonly reporter: FinanceReporter | null
  private readonly environment: PaymentEnvironment
  private readonly pendingTtlMs: number

  constructor(config: PayConfig) {
    this.config = config
    this.store = config.store
    this.environment =
      config.environment ??
      (process.env.PAY_ENVIRONMENT?.trim().toLowerCase() === "test"
        ? "test"
        : "live")
    this.pendingTtlMs = (config.pendingTtlMinutes ?? 30) * 60_000

    const requested = config.gateways ?? BUILT_IN_ADAPTERS
    for (const entry of requested) {
      const adapter =
        typeof entry === "string"
          ? BUILT_IN_ADAPTERS.find((candidate) => candidate.code === entry)
          : entry
      if (!adapter) {
        throw new PayError(
          "GATEWAY_NOT_AVAILABLE",
          `Unknown gateway "${String(entry)}". Built-in gateways: ${BUILT_IN_ADAPTERS.map((item) => item.code).join(", ")}.`
        )
      }
      // When no explicit list is given, only configured gateways are offered.
      if (config.gateways || adapter.isConfigured()) {
        this.adapters.set(adapter.code, adapter)
      }
    }

    this.reporter = this.createReporter(config.report)
  }

  private createReporter(report: PayConfig["report"]) {
    if (report === false) {
      return null
    }
    if (report) {
      return new FinanceReporter(report)
    }
    const baseUrl = process.env.OBH_BASE_URL?.trim()
    const secretKey = process.env.OBH_SERVICE_KEY?.trim()
    return baseUrl && secretKey
      ? new FinanceReporter({ baseUrl, secretKey })
      : null
  }

  /** Gateways this service can offer right now. */
  listGateways(): Array<PaymentGatewayDescriptor & { isDefault: boolean }> {
    const fallback = this.defaultGatewayCode()
    return [...this.adapters.values()]
      .filter((adapter) => adapter.isConfigured())
      .map((adapter) => ({
        ...adapter.descriptor,
        isDefault: adapter.code === fallback,
      }))
  }

  /** Checks the OBH credential and connectivity. Throws on failure. */
  async pingObh() {
    if (!this.reporter) {
      throw new PayError(
        "REPORT_FAILED",
        "Finance reporting is not configured (OBH_BASE_URL / OBH_SERVICE_KEY)."
      )
    }
    return this.reporter.ping()
  }

  private defaultGatewayCode() {
    if (
      this.config.defaultGateway &&
      this.adapters.has(this.config.defaultGateway)
    ) {
      return this.config.defaultGateway
    }
    return (
      [...this.adapters.values()].find((adapter) => adapter.isConfigured())
        ?.code ?? null
    )
  }

  private getAdapter(code: string | undefined) {
    const resolved = code ?? this.defaultGatewayCode()
    const adapter = resolved ? this.adapters.get(resolved) : undefined

    if (!adapter || !adapter.isConfigured()) {
      throw new PayError(
        "GATEWAY_NOT_AVAILABLE",
        resolved
          ? `Gateway "${resolved}" is not enabled or has no credentials.`
          : "No payment gateway is configured."
      )
    }
    return adapter
  }

  private callbackUrl(gateway: string) {
    const path = (this.config.callbackPath ?? "/api/pay/{gateway}/callback")
      .replace("{gateway}", encodeURIComponent(gateway))
    return `${this.config.baseUrl.replace(/\/+$/, "")}${path}`
  }

  /**
   * Opens a payment session at the chosen gateway and returns where to send
   * the customer. The attempt is stored before the gateway is called so a
   * fast callback can always find it.
   */
  async start(input: StartPaymentInput): Promise<StartedPayment> {
    const orderId = input.orderId?.trim()
    const amount = String(input.amount).trim()

    if (!orderId || orderId.length > 191) {
      throw new PayError("INVALID_REQUEST", "orderId is required (max 191).")
    }
    if (!/^[1-9]\d{0,17}$/.test(amount)) {
      throw new PayError(
        "INVALID_REQUEST",
        "amount must be a whole Rial amount greater than zero."
      )
    }
    if (!input.description?.trim()) {
      throw new PayError("INVALID_REQUEST", "description is required.")
    }

    const adapter = this.getAdapter(input.gateway)
    const min = adapter.descriptor.minAmount
    if (min && BigInt(amount) < BigInt(min)) {
      throw new PayError(
        "INVALID_REQUEST",
        `${adapter.descriptor.name} requires at least ${min} Rials.`
      )
    }
    if (adapter.descriptor.requiresCustomerMobile && !input.customerMobile) {
      throw new PayError(
        "INVALID_REQUEST",
        `${adapter.descriptor.name} requires customerMobile.`
      )
    }

    const previous = await this.store.listByOrderId(orderId)
    const now = new Date()

    if (previous.some((record) => record.status === "completed")) {
      throw new PayError(
        "ORDER_ALREADY_PAID",
        `Order ${orderId} already has a completed payment.`
      )
    }

    // An open session for the same order, gateway and amount is resumed so a
    // double click does not create two bank sessions.
    const open = previous.find(
      (record) =>
        record.status === "pending" &&
        record.gateway === adapter.code &&
        record.amount === amount &&
        record.redirect &&
        record.expiresAt &&
        record.expiresAt.getTime() > now.getTime()
    )
    if (open?.redirect) {
      return { payment: open, redirect: open.redirect, reused: true }
    }

    const gatewayOrderId = await this.store.nextGatewayOrderId(adapter.code)
    const record: PaymentRecord = {
      reference: createReference(),
      orderId,
      attempt: previous.length + 1,
      gateway: adapter.code,
      gatewayOrderId,
      amount,
      currency: "IRR",
      description: input.description.trim(),
      status: "pending",
      environment: this.environment,
      returnUrl: input.returnUrl ?? null,
      customerMobile: input.customerMobile ?? null,
      metadata: input.metadata ?? {},
      providerSessionId: null,
      providerReference: null,
      traceNumber: null,
      maskedCardNumber: null,
      resultCode: null,
      resultText: null,
      installment: null,
      redirect: null,
      callbackPayload: null,
      createdAt: now,
      expiresAt: null,
      callbackReceivedAt: null,
      completedAt: null,
      failedAt: null,
      reportedStatus: null,
      reportedAt: null,
    }
    await this.store.insert(record)

    try {
      const session = await adapter.createCheckoutSession({
        paymentReference: record.reference,
        gatewayOrderId,
        serviceSlug: this.config.service,
        amount,
        currency: "IRR",
        description: record.description,
        returnUrl: record.returnUrl,
        callbackUrl: this.callbackUrl(adapter.code),
        metadata: record.metadata,
        customerMobile: record.customerMobile,
      })

      const redirect: CheckoutRedirect =
        session.redirect ??
        (session.checkoutUrl
          ? { method: "GET", url: session.checkoutUrl }
          : (() => {
              throw new PayError(
                "GATEWAY_ERROR",
                `${adapter.descriptor.name} returned no checkout URL.`
              )
            })())

      const payment = await this.store.update(record.reference, {
        providerSessionId: session.providerSessionId,
        providerReference: session.providerReference,
        redirect,
        expiresAt: session.expiresAt,
        resultCode: session.resultCode,
        resultText: session.resultMessage,
      })

      // Fire and forget: opening a session must not wait on OBH.
      void this.report(payment)

      return { payment, redirect, reused: false }
    } catch (error) {
      const text =
        error instanceof PaymentProviderError || error instanceof PayError
          ? error.message
          : "Could not open a payment session."
      const failed = await this.store.transition(record.reference, "pending", {
        status: "failed",
        failedAt: new Date(),
        resultCode:
          error instanceof PaymentProviderError
            ? (error.resultCode ?? null)
            : null,
        resultText: text,
      })
      if (failed) {
        await this.report(failed)
      }
      if (error instanceof PayError) {
        throw error
      }
      throw new PayError("GATEWAY_ERROR", text, {
        gateway: adapter.code,
        reference: record.reference,
      })
    }
  }

  /**
   * Processes the request the bank sends the customer back with: finds the
   * payment, verifies it server-to-server and records the outcome. Safe to
   * call twice; the second call returns the final payment unchanged.
   */
  async handleCallback(
    gateway: string,
    payload: Record<string, string | null | undefined>
  ): Promise<CallbackResult> {
    const adapter = this.getAdapter(gateway)
    const parsed = adapter.parseCallback(payload)

    let payment: PaymentRecord | null = null
    if (parsed.sessionId) {
      payment = await this.store.findBySessionId(gateway, parsed.sessionId)
    }
    if (!payment && !parsed.sessionId && parsed.gatewayOrderId) {
      payment = await this.store.findByGatewayOrderId(
        gateway,
        parsed.gatewayOrderId
      )
    }
    if (!payment && parsed.sessionId && parsed.gatewayOrderId) {
      // Sadad can omit the token; the order number is then the only key.
      payment = await this.store.findByGatewayOrderId(
        gateway,
        parsed.gatewayOrderId
      )
    }
    if (!payment) {
      throw new PayError("PAYMENT_NOT_FOUND", "Payment was not found.")
    }
    if (
      parsed.gatewayOrderId &&
      parsed.gatewayOrderId !== payment.gatewayOrderId
    ) {
      throw new PayError(
        "ORDER_MISMATCH",
        "Callback order number does not match the stored payment."
      )
    }
    if (payment.status !== "pending") {
      return { payment, replayed: true }
    }

    const now = new Date()
    payment = await this.store.update(payment.reference, {
      callbackReceivedAt: payment.callbackReceivedAt ?? now,
      maskedCardNumber: parsed.maskedCardNumber ?? payment.maskedCardNumber,
      providerReference: parsed.providerReference ?? payment.providerReference,
      resultCode: parsed.resultCode,
      resultText: parsed.resultText,
      callbackPayload: parsed.payload,
    })

    if (parsed.outcome === "failed") {
      return this.finish(payment, {
        status: "failed",
        failedAt: now,
        resultCode: parsed.resultCode,
        resultText: parsed.resultText,
      })
    }

    return this.verify(payment)
  }

  /** Verifies a pending payment with the gateway and records the result. */
  private async verify(payment: PaymentRecord): Promise<CallbackResult> {
    const adapter = this.getAdapter(payment.gateway)

    let verification
    try {
      verification = await adapter.verifyPayment({
        providerSessionId: payment.providerSessionId,
        providerReference: payment.providerReference,
        gatewayOrderId: payment.gatewayOrderId,
        expectedAmount: payment.amount,
        payload: payment.callbackPayload ?? undefined,
      })
    } catch (error) {
      // Not proof of failure; leave it pending so reconcile() retries.
      await this.store.update(payment.reference, {
        resultText: `Verify could not complete: ${describeError(error)}`,
      })
      return { payment: (await this.store.findByReference(payment.reference)) ?? payment, replayed: false }
    }

    if (verification.status === "PENDING") {
      const updated = await this.store.update(payment.reference, {
        resultCode: verification.resultCode,
        resultText: verification.resultMessage,
      })
      return { payment: updated, replayed: false }
    }

    const verifiedAmount = verification.verifiedAmount
    if (
      verification.status === "COMPLETED" &&
      verifiedAmount !== null &&
      verifiedAmount !== payment.amount
    ) {
      // The bank settled a different amount than we asked for. Never mark it
      // paid; keep the evidence on the failed record for manual review.
      return this.finish(payment, {
        status: "failed",
        failedAt: new Date(),
        resultCode: verification.resultCode,
        resultText: `Amount mismatch: expected ${payment.amount}, bank verified ${verifiedAmount}.`,
        providerReference: verification.providerReference,
        traceNumber: verification.traceNumber,
      })
    }

    const at = verification.verifiedAt ?? new Date()
    const completed = verification.status === "COMPLETED"

    return this.finish(payment, {
      status: completed ? "completed" : "failed",
      completedAt: completed ? at : null,
      failedAt: completed ? null : at,
      providerReference: verification.providerReference,
      traceNumber: verification.traceNumber,
      maskedCardNumber:
        verification.maskedCardNumber ?? payment.maskedCardNumber,
      resultCode: verification.resultCode,
      resultText: verification.resultMessage,
      installment: completed ? installmentFrom(verification.metadata) : null,
    })
  }

  private async finish(
    payment: PaymentRecord,
    patch: Partial<PaymentRecord> & { status: PaymentStatus }
  ): Promise<CallbackResult> {
    const updated = await this.store.transition(
      payment.reference,
      "pending",
      patch
    )

    if (!updated) {
      // Another request finished it first; return whatever it recorded.
      const current = await this.store.findByReference(payment.reference)
      return { payment: current ?? payment, replayed: true }
    }

    await this.report(updated)
    return { payment: updated, replayed: false }
  }

  async get(reference: string): Promise<PaymentRecord | null> {
    return this.store.findByReference(reference)
  }

  /**
   * Verifies a still-pending payment again, now. Use it when the customer
   * is back (result page, "check again") and the first verify did not come
   * back with an answer. Only payments whose bank callback arrived are
   * verified; anything else is returned unchanged.
   */
  async recheck(reference: string): Promise<PaymentRecord | null> {
    const payment = await this.store.findByReference(reference)
    if (!payment || payment.status !== "pending" || !payment.callbackReceivedAt) {
      return payment
    }
    return (await this.verify(payment)).payment
  }

  /**
   * Housekeeping to run every few minutes (cron, queue, or a scheduled
   * route): expires abandoned sessions, retries verifies that hit a network
   * error, and re-sends reports OBH has not acknowledged.
   */
  async reconcile(limit = 100): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = { expired: 0, reverified: 0, reported: 0 }
    const cutoff = new Date(Date.now() - 2 * 60_000)

    for (const payment of await this.store.listPending(cutoff, limit)) {
      if (payment.callbackReceivedAt) {
        const result = await this.verify(payment)
        if (result.payment.status !== "pending") {
          summary.reverified += 1
        }
        continue
      }

      const age = Date.now() - payment.createdAt.getTime()
      if (age >= this.pendingTtlMs) {
        const expired = await this.store.transition(
          payment.reference,
          "pending",
          {
            status: "expired",
            failedAt: new Date(),
            resultText: "No gateway callback was received before expiry.",
          }
        )
        if (expired) {
          summary.expired += 1
          await this.report(expired)
        }
      }
    }

    for (const payment of await this.store.listUnreported(limit)) {
      if (await this.report(payment)) {
        summary.reported += 1
      }
    }

    return summary
  }

  /** Sends one snapshot to OBH. Returns true when OBH acknowledged it. */
  private async report(payment: PaymentRecord): Promise<boolean> {
    if (!this.reporter) {
      return false
    }

    try {
      await this.reporter.sendPayment(payment)
      await this.store.update(payment.reference, {
        reportedStatus: payment.status,
        reportedAt: new Date(),
      })
      return true
    } catch (error) {
      this.config.onReportError?.(error, payment)
      return false
    }
  }
}

export function createPay(config: PayConfig) {
  return new Pay(config)
}

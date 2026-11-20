import "server-only"

import { randomUUID } from "node:crypto"

import { getDb } from "@/lib/db/client"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  buildKisanInvoice,
  KISAN_STATUS_LABELS,
  STUFF_ID_PATTERN,
  TAX_ERROR_LABELS,
  type InvoiceBuyerInput,
} from "@/lib/tax-invoices/build"
import { tehranStartOfDay, vatRateOn } from "@/lib/vat/rules"
import { formatDateOnly, todayDateOnlyInTehran } from "@/server/accounting/dates"
import { DomainError } from "@/server/errors"
import {
  inquireInvoices,
  isKisanConfigured,
  KisanError,
  kisanField,
  kisanText,
  registerService,
  revokeInvoices,
  sendInvoices,
} from "@/server/tax-invoices/kisan"

/**
 * Electronic invoices for every LIVE sale, sent to سامانه مودیان through
 * Kisan. From the VAT registration date (`VatProfile.effectiveFrom`), each
 * completed incoming LIVE payment gets one invoice: type 2 (no buyer), or
 * type 1 when its service sent buyer details (`InvoiceBuyer`, through
 * `/api/v1/finance/orders/{orderId}/invoice`). Buyer details that arrive after
 * a type-2 invoice was issued revoke it and issue a type-1 one.
 *
 * `syncTaxInvoices` (cron, `pnpm --filter web tax-invoices`) creates missing
 * invoices, sends pending ones in batches and checks sent ones until the tax
 * system takes them (Kisan status 14) or refuses them (18). A refused invoice
 * is FAILED and waits for a manager to fix it and resend from /admin/tax-invoices.
 */

/** A sale with no buyer details waits this long before its type-2 invoice, so a
 * service that sends the buyer's details right after checkout gets type 1. */
const BUYER_GRACE_MS = 2 * 60 * 60 * 1000
const SEND_BATCH = 25
const CHECK_BATCH = 50

const KISAN_ACCEPTED = 3
const KISAN_DUPLICATE = 2
const KISAN_DONE = 14
const KISAN_REVOKED = 17
const KISAN_NEEDS_REVIEW = 18

const invoiceInclude = {
  payment: {
    select: {
      id: true,
      reference: true,
      amount: true,
      description: true,
      completedAt: true,
      invoiceBuyer: true,
      service: {
        select: { name: true, taxStuffId: true, taxStuffRegisteredAt: true },
      },
    },
  },
} satisfies Prisma.TaxInvoiceInclude

type InvoiceWithPayment = Prisma.TaxInvoiceGetPayload<{ include: typeof invoiceInclude }>

/** Tehran midnight of the VAT registration day, or null before registration. */
export async function invoicingStartsAt() {
  const profile = await getDb().vatProfile.findUnique({ where: { id: "default" } })
  return profile ? tehranStartOfDay(formatDateOnly(profile.effectiveFrom)) : null
}

function liveSalesFrom(start: Date): Prisma.PaymentWhereInput {
  return {
    environment: "LIVE",
    status: "COMPLETED",
    direction: "INCOMING",
    completedAt: { gte: start },
  }
}

function reviewMessage(code: string) {
  return `Needs review${code ? ` (${code})` : ""}: ${
    TAX_ERROR_LABELS[code] ?? "see the invoice in Kisan's panel."
  }`
}

function buyerInput(buyer: NonNullable<InvoiceWithPayment["payment"]["invoiceBuyer"]>): InvoiceBuyerInput {
  return {
    buyerType: buyer.buyerType === 2 ? 2 : 1,
    name: buyer.name,
    nationalId: buyer.nationalId,
    economicCode: buyer.economicCode,
    postalCode: buyer.postalCode,
    phone: buyer.phone,
  }
}

// ── Creating invoices and following buyer changes ──────────────────────

/**
 * Creates the invoices sales are missing and moves invoices to the type their
 * buyer details call for. Returns how many invoices were created.
 */
async function ensureInvoices(start: Date, limit: number, now: Date) {
  const db = getDb()
  let created = 0

  const missing = await db.payment.findMany({
    where: {
      ...liveSalesFrom(start),
      taxInvoices: { none: { status: { not: "CANCELLED" } } },
      OR: [
        { completedAt: { lte: new Date(now.getTime() - BUYER_GRACE_MS) } },
        { invoiceBuyer: { isNot: null } },
      ],
    },
    orderBy: { completedAt: "asc" },
    take: limit,
    select: { id: true, invoiceBuyer: { select: { paymentId: true } } },
  })
  for (const payment of missing) {
    await db.taxInvoice.create({
      data: {
        paymentId: payment.id,
        uniqueId: randomUUID(),
        invoiceType: payment.invoiceBuyer ? 1 : 2,
      },
    })
    created++
  }

  // Buyer details arrived for a sale whose invoice is type 2.
  const toTypeOne = await db.taxInvoice.findMany({
    where: {
      invoiceType: 2,
      status: { not: "CANCELLED" },
      payment: { invoiceBuyer: { isNot: null } },
    },
    take: limit,
  })
  for (const invoice of toTypeOne) {
    if (invoice.status === "PENDING" || invoice.status === "FAILED") {
      // Not in the tax workspace: change it in place (Kisan edits it if it holds it).
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: { invoiceType: 1, status: "PENDING", lastError: null },
      })
    } else if (invoice.status === "ISSUED") {
      await replaceIssuedInvoice(invoice.id)
    }
    // SENT: wait until the tax system settles it.
  }

  // Buyer details were withdrawn before a type-1 invoice was sent.
  await db.taxInvoice.updateMany({
    where: {
      invoiceType: 1,
      status: { in: ["PENDING", "FAILED"] },
      trackingId: null,
      payment: { invoiceBuyer: { is: null } },
    },
    data: { invoiceType: 2, status: "PENDING", lastError: null },
  })

  return created
}

/** Revokes an issued type-2 invoice at Kisan and queues a type-1 one instead. */
async function replaceIssuedInvoice(invoiceId: string) {
  const db = getDb()
  const invoice = await db.taxInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payment: { select: { completedAt: true } } },
  })
  if (!invoice.taxId || !invoice.payment.completedAt) return

  const revokeUniqueId = invoice.revokeUniqueId ?? randomUUID()
  if (!invoice.revokeUniqueId) {
    await db.taxInvoice.update({ where: { id: invoice.id }, data: { revokeUniqueId } })
  }
  let rows: unknown[]
  try {
    rows = await revokeInvoices([
      {
        uniqueId: revokeUniqueId,
        invoiceNumber: String(invoice.number),
        invoiceDate: invoice.payment.completedAt.toISOString(),
        referenceTaxSerialNumber: invoice.taxId,
        description: "ابطال برای صدور صورتحساب نوع اول",
      },
    ])
  } catch (error) {
    await db.taxInvoice.update({
      where: { id: invoice.id },
      data: { lastError: `Revoking for a type-1 invoice failed: ${messageOf(error)}` },
    })
    return
  }
  const row = rows[0]
  const status = Number(kisanField(row, "status"))
  if (status !== KISAN_ACCEPTED) {
    await db.taxInvoice.update({
      where: { id: invoice.id },
      data: {
        lastError: `Kisan refused to revoke it for a type-1 invoice: ${
          kisanText(kisanField(row, "description")) || `status ${status}`
        }`,
      },
    })
    return
  }
  await db.$transaction([
    db.taxInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        revokeTaxId: kisanText(kisanField(row, "taxSerialNumber")) || null,
        lastError: null,
      },
    }),
    db.taxInvoice.create({
      data: { paymentId: invoice.paymentId, uniqueId: randomUUID(), invoiceType: 1 },
    }),
  ])
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error."
}

// ── Sending ─────────────────────────────────────────────────────────────

function payloadFor(invoice: InvoiceWithPayment) {
  const { payment } = invoice
  const service = payment.service
  if (!service?.taxStuffId) {
    return { error: `${service?.name ?? "This payment's service"} has no tax service id yet.` }
  }
  if (!service.taxStuffRegisteredAt) {
    return { error: `${service.name}'s tax service id is not registered at Kisan yet.` }
  }
  if (!payment.completedAt) return { error: "The payment has no completion time." }
  const buyer = invoice.invoiceType === 1 ? payment.invoiceBuyer : null
  if (invoice.invoiceType === 1 && !buyer) return { error: "The buyer details are missing." }

  const title = `${service.name}: ${payment.description}`.slice(0, 120)
  return {
    payload: buildKisanInvoice({
      number: invoice.number,
      uniqueId: invoice.uniqueId,
      stuffId: service.taxStuffId,
      title,
      grossRials: BigInt(payment.amount.toFixed(0)),
      vatPercent: vatRateOn(todayDateOnlyInTehran(payment.completedAt)),
      paidAt: payment.completedAt,
      buyer: buyer ? buyerInput(buyer) : null,
      // Kisan edits an invoice it already holds instead of taking a second one.
      isUpdate: invoice.trackingId !== null,
    }),
  }
}

/** Sends these invoices to Kisan and records each answer. */
async function sendBatch(invoices: InvoiceWithPayment[]) {
  const db = getDb()
  const now = new Date()
  const ready: Array<{ invoice: InvoiceWithPayment; payload: unknown }> = []
  let failed = 0

  for (const invoice of invoices) {
    const built = payloadFor(invoice)
    if ("error" in built) {
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: { lastError: built.error, checkedAt: now },
      })
      failed++
    } else {
      ready.push({ invoice, payload: built.payload })
    }
  }
  if (ready.length === 0) return { sent: 0, failed }

  // A transport failure leaves them PENDING for the next run.
  let rows: unknown[]
  try {
    rows = await sendInvoices(ready.map((item) => item.payload))
  } catch (error) {
    await db.taxInvoice.updateMany({
      where: { id: { in: ready.map((item) => item.invoice.id) } },
      data: { lastError: messageOf(error), checkedAt: now },
    })
    throw error
  }

  const byUniqueId = new Map(
    rows.map((row) => [kisanText(kisanField(row, "uniqueId")).toLowerCase(), row])
  )
  let sent = 0
  for (const [index, { invoice }] of ready.entries()) {
    const row =
      byUniqueId.get(invoice.uniqueId.toLowerCase()) ??
      (rows.length === ready.length ? rows[index] : undefined)
    const status = Number(kisanField(row, "status"))

    if (status === KISAN_ACCEPTED) {
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "SENT",
          kisanStatus: status,
          trackingId: kisanText(kisanField(row, "trakingId", "trackingId")) || invoice.trackingId,
          taxId: kisanText(kisanField(row, "taxSerialNumber")) || null,
          lastError: null,
          sentAt: now,
          checkedAt: now,
        },
      })
      sent++
    } else if (status === KISAN_DUPLICATE) {
      // Probably our own earlier send whose answer was lost; checking settles it.
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: { status: "SENT", kisanStatus: status, lastError: null, checkedAt: now },
      })
      sent++
    } else {
      const title = kisanText(kisanField(row, "title"))
      const description = kisanText(kisanField(row, "description"))
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "FAILED",
          kisanStatus: Number.isFinite(status) ? status : null,
          lastError:
            [KISAN_STATUS_LABELS[status], description, title && `(field ${title})`]
              .filter(Boolean)
              .join(" ") || "Kisan did not accept the invoice.",
          checkedAt: now,
        },
      })
      failed++
    }
  }
  return { sent, failed }
}

async function sendPending(limit: number) {
  const db = getDb()
  const pending = await db.taxInvoice.findMany({
    where: { status: "PENDING" },
    orderBy: { number: "asc" },
    take: limit,
    include: invoiceInclude,
  })
  let sent = 0
  let failed = 0
  for (let index = 0; index < pending.length; index += SEND_BATCH) {
    const result = await sendBatch(pending.slice(index, index + SEND_BATCH))
    sent += result.sent
    failed += result.failed
  }
  return { sent, failed }
}

// ── Checking ────────────────────────────────────────────────────────────

/** Asks Kisan where these invoices are and records it. Returns how many were issued. */
async function checkBatch(
  invoices: Array<{ id: string; uniqueId: string; kisanStatus: number | null; taxId: string | null; trackingId: string | null }>
) {
  const db = getDb()
  const now = new Date()
  const rows = await inquireInvoices(invoices.map((invoice) => invoice.uniqueId))
  const byUniqueId = new Map(
    rows.map((row) => [kisanText(kisanField(row, "uniqueId")).toLowerCase(), row])
  )
  let issued = 0

  for (const [index, invoice] of invoices.entries()) {
    const row =
      byUniqueId.get(invoice.uniqueId.toLowerCase()) ??
      (rows.length === invoices.length ? rows[index] : undefined)
    const status = Number(kisanField(row, "status"))

    if (!row || !Number.isFinite(status)) {
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data:
          invoice.kisanStatus === KISAN_DUPLICATE
            ? {
                status: "FAILED",
                lastError:
                  "Kisan already has another invoice with this number and date. Check Kisan's panel.",
                checkedAt: now,
              }
            : {
                status: "PENDING",
                lastError: "Kisan has no record of it; it will be sent again.",
                checkedAt: now,
              },
      })
      continue
    }

    const common = {
      kisanStatus: status,
      taxId: kisanText(kisanField(row, "taxSerialNumber")) || invoice.taxId,
      trackingId: kisanText(kisanField(row, "trackingId", "trakingId")) || invoice.trackingId,
      checkedAt: now,
    }
    if (status === KISAN_DONE) {
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: { ...common, status: "ISSUED", issuedAt: now, lastError: null },
      })
      issued++
    } else if (status === KISAN_NEEDS_REVIEW) {
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: {
          ...common,
          status: "FAILED",
          lastError: reviewMessage(kisanText(kisanField(row, "message"))),
        },
      })
    } else if (status === KISAN_REVOKED) {
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: {
          ...common,
          status: "CANCELLED",
          cancelledAt: now,
          lastError: "Revoked in Kisan's panel.",
        },
      })
    } else {
      await db.taxInvoice.update({
        where: { id: invoice.id },
        data: { ...common, status: "SENT", lastError: null },
      })
    }
  }
  return issued
}

async function checkSent(limit: number) {
  const sent = await getDb().taxInvoice.findMany({
    where: { status: "SENT" },
    orderBy: [{ checkedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true, uniqueId: true, kisanStatus: true, taxId: true, trackingId: true },
  })
  let issued = 0
  for (let index = 0; index < sent.length; index += CHECK_BATCH) {
    issued += await checkBatch(sent.slice(index, index + CHECK_BATCH))
  }
  return issued
}

// ── The scheduled run ───────────────────────────────────────────────────

export type TaxInvoiceSyncResult =
  | { status: "off"; reason: string }
  | { status: "done"; created: number; sent: number; issued: number; failed: number; error?: string }

export async function syncTaxInvoices(limit = 300, now = new Date()): Promise<TaxInvoiceSyncResult> {
  if (!isKisanConfigured()) return { status: "off", reason: "Kisan is not configured." }
  const start = await invoicingStartsAt()
  if (!start) return { status: "off", reason: "No VAT registration date (Admin → VAT)." }

  let created = 0
  let sent = 0
  let issued = 0
  let failed = 0
  try {
    created = await ensureInvoices(start, limit, now)
    const sending = await sendPending(limit)
    sent = sending.sent
    failed = sending.failed
    issued = await checkSent(limit)
  } catch (error) {
    if (!(error instanceof KisanError)) throw error
    return { status: "done", created, sent, issued, failed, error: error.message }
  }
  return { status: "done", created, sent, issued, failed }
}

// ── Manager actions ─────────────────────────────────────────────────────

async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue
) {
  await getDb().auditLog.create({
    data: { actorId, action, entityType, entityId, ...(metadata ? { metadata } : {}) },
  })
}

function requireKisan() {
  if (!isKisanConfigured()) {
    throw new DomainError("KISAN_OFF", "Kisan is not configured (KISAN_* variables).")
  }
}

/** Sends one invoice now: a pending one, or a failed one after it was fixed. */
export async function resendTaxInvoice(actorId: string, invoiceId: string) {
  requireKisan()
  const db = getDb()
  const invoice = await db.taxInvoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude })
  if (!invoice) throw new DomainError("NOT_FOUND", "The invoice was not found.")
  if (invoice.status !== "PENDING" && invoice.status !== "FAILED") {
    throw new DomainError("INVOICE_STATE", "Only pending or failed invoices can be sent.")
  }
  await db.taxInvoice.update({ where: { id: invoice.id }, data: { status: "PENDING", lastError: null } })
  try {
    await sendBatch([{ ...invoice, status: "PENDING" }])
  } catch (error) {
    throw new DomainError("KISAN", messageOf(error))
  }
  await audit(actorId, "tax_invoice.sent", "TaxInvoice", invoice.id, { number: invoice.number })
  return db.taxInvoice.findUniqueOrThrow({ where: { id: invoice.id } })
}

/** Asks Kisan about one invoice it holds now. */
export async function checkTaxInvoice(invoiceId: string) {
  requireKisan()
  const db = getDb()
  const invoice = await db.taxInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, uniqueId: true, kisanStatus: true, taxId: true, trackingId: true, status: true },
  })
  if (!invoice) throw new DomainError("NOT_FOUND", "The invoice was not found.")
  if (invoice.status === "PENDING" || invoice.status === "CANCELLED") {
    throw new DomainError("INVOICE_STATE", "Kisan does not hold this invoice.")
  }
  try {
    await checkBatch([invoice])
  } catch (error) {
    throw new DomainError("KISAN", messageOf(error))
  }
  return db.taxInvoice.findUniqueOrThrow({ where: { id: invoice.id } })
}

/** Runs the scheduled sync now. */
export async function runTaxInvoiceSync(actorId: string) {
  requireKisan()
  const result = await syncTaxInvoices()
  if (result.status === "off") throw new DomainError("KISAN_OFF", result.reason)
  await audit(actorId, "tax_invoice.sync", "TaxInvoice", "sync", {
    created: result.created,
    sent: result.sent,
    issued: result.issued,
    failed: result.failed,
  })
  return result
}

/** Sets the 13-digit goods/service id a service's sales are invoiced under. */
export async function setServiceTaxStuffId(actorId: string, serviceId: string, stuffId: string) {
  if (!STUFF_ID_PATTERN.test(stuffId)) {
    throw new DomainError("STUFF_ID", "The service id must be 13 digits.")
  }
  const db = getDb()
  const before = await db.connectedService.findUnique({ where: { id: serviceId } })
  if (!before) throw new DomainError("NOT_FOUND", "The service was not found.")
  if (before.taxStuffId === stuffId) return before
  const service = await db.connectedService.update({
    where: { id: serviceId },
    data: { taxStuffId: stuffId, taxStuffRegisteredAt: null },
  })
  await audit(actorId, "service.tax_stuff_id", "ConnectedService", serviceId, {
    before: before.taxStuffId,
    after: stuffId,
  })
  return service
}

/** Registers a service's goods/service id at Kisan (once, before its first invoice). */
export async function registerServiceTaxStuffId(actorId: string, serviceId: string) {
  requireKisan()
  const db = getDb()
  const service = await db.connectedService.findUnique({ where: { id: serviceId } })
  if (!service?.taxStuffId) {
    throw new DomainError("STUFF_ID", "Set the service's 13-digit id first.")
  }
  let result: { ok: boolean; message: string }
  try {
    result = await registerService(
      service.taxStuffId,
      service.name,
      vatRateOn(todayDateOnlyInTehran())
    )
  } catch (error) {
    throw new DomainError("KISAN", messageOf(error))
  }
  if (!result.ok) {
    throw new DomainError("KISAN", result.message || "Kisan did not register the service id.")
  }
  await db.connectedService.update({
    where: { id: serviceId },
    data: { taxStuffRegisteredAt: new Date() },
  })
  await audit(actorId, "service.tax_stuff_registered", "ConnectedService", serviceId, {
    stuffId: service.taxStuffId,
  })
}

// ── The service API ─────────────────────────────────────────────────────

/** The completed payment of a service's order (the last attempt that succeeded). */
async function findOrderPayment(serviceId: string, orderId: string) {
  return getDb().payment.findFirst({
    where: {
      serviceId,
      status: "COMPLETED",
      OR: [{ externalOrderId: orderId }, { externalOrderId: { startsWith: `${orderId}~` } }],
    },
    orderBy: { completedAt: "desc" },
    select: { id: true, environment: true, completedAt: true },
  })
}

export type OrderInvoiceView = {
  orderId: string
  environment: "LIVE" | "TEST"
  hasBuyer: boolean
  invoice: {
    number: number
    type: number
    status: "PENDING" | "SENT" | "ISSUED" | "FAILED"
    taxId: string | null
    issuedAt: string | null
    error: string | null
  } | null
}

async function viewOrder(paymentId: string, orderId: string, environment: "LIVE" | "TEST") {
  const db = getDb()
  const [buyer, invoice] = await Promise.all([
    db.invoiceBuyer.findUnique({ where: { paymentId }, select: { paymentId: true } }),
    db.taxInvoice.findFirst({
      where: { paymentId, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
    }),
  ])
  const view: OrderInvoiceView = {
    orderId,
    environment,
    hasBuyer: buyer !== null,
    invoice:
      invoice && invoice.status !== "CANCELLED"
        ? {
            number: invoice.number,
            type: invoice.invoiceType,
            status: invoice.status,
            taxId: invoice.status === "ISSUED" ? invoice.taxId : null,
            issuedAt: invoice.issuedAt?.toISOString() ?? null,
            error: invoice.status === "FAILED" ? invoice.lastError : null,
          }
        : null,
  }
  return view
}

/** The invoice state of a service's order. Null when the order has no completed payment. */
export async function getOrderInvoice(serviceId: string, orderId: string) {
  const payment = await findOrderPayment(serviceId, orderId)
  if (!payment) return null
  return viewOrder(payment.id, orderId, payment.environment)
}

/**
 * Records the buyer of a service's order, so its sale is invoiced as type 1.
 * Refused once a type-1 invoice for it reached Kisan.
 */
export async function setOrderInvoiceBuyer(
  serviceId: string,
  orderId: string,
  buyer: Omit<InvoiceBuyerInput, "economicCode"> & { economicCode?: string | null }
) {
  const db = getDb()
  const payment = await findOrderPayment(serviceId, orderId)
  if (!payment) throw new DomainError("NOT_FOUND", "No completed payment for this order.")

  const active = await db.taxInvoice.findFirst({
    where: { paymentId: payment.id, status: { in: ["SENT", "ISSUED"] }, invoiceType: 1 },
  })
  const data = {
    buyerType: buyer.buyerType,
    name: buyer.name,
    nationalId: buyer.nationalId,
    economicCode: buyer.economicCode || null,
    postalCode: buyer.postalCode,
    phone: buyer.phone,
  }
  if (active) {
    const current = await db.invoiceBuyer.findUnique({ where: { paymentId: payment.id } })
    const same =
      current &&
      (Object.keys(data) as Array<keyof typeof data>).every((key) => current[key] === data[key])
    if (!same) {
      throw new DomainError(
        "INVOICE_ISSUED",
        "This order's official invoice is already with the tax system; it cannot be changed."
      )
    }
  } else {
    await db.invoiceBuyer.upsert({
      where: { paymentId: payment.id },
      create: { paymentId: payment.id, ...data },
      update: data,
    })
    // Back to pending so a failed type-1 invoice is retried with the new details.
    await db.taxInvoice.updateMany({
      where: { paymentId: payment.id, invoiceType: 1, status: "FAILED" },
      data: { status: "PENDING", lastError: null },
    })
  }
  return viewOrder(payment.id, orderId, payment.environment)
}

/** Withdraws an order's buyer details (the sale goes back to type 2) while still possible. */
export async function removeOrderInvoiceBuyer(serviceId: string, orderId: string) {
  const db = getDb()
  const payment = await findOrderPayment(serviceId, orderId)
  if (!payment) throw new DomainError("NOT_FOUND", "No completed payment for this order.")
  const held = await db.taxInvoice.findFirst({
    where: {
      paymentId: payment.id,
      invoiceType: 1,
      OR: [{ status: { in: ["SENT", "ISSUED"] } }, { trackingId: { not: null }, status: { not: "CANCELLED" } }],
    },
  })
  if (held) {
    throw new DomainError(
      "INVOICE_ISSUED",
      "This order's official invoice already reached Kisan; it cannot be withdrawn."
    )
  }
  await db.invoiceBuyer.deleteMany({ where: { paymentId: payment.id } })
  return viewOrder(payment.id, orderId, payment.environment)
}

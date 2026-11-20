import "server-only"

import { getDb } from "@/lib/db/client"
import type { Prisma } from "@/lib/generated/prisma/client"
import { KISAN_STATUS_LABELS } from "@/lib/tax-invoices/build"
import { todayDateOnlyInTehran } from "@/server/accounting/dates"
import { isKisanConfigured } from "@/server/tax-invoices/kisan"
import { invoicingStartsAt } from "@/server/tax-invoices/service"

export const TAX_INVOICE_TABS = ["attention", "in-progress", "issued", "cancelled"] as const
export type TaxInvoiceTab = (typeof TAX_INVOICE_TABS)[number]

const whereByTab: Record<TaxInvoiceTab, Prisma.TaxInvoiceWhereInput> = {
  attention: { OR: [{ status: "FAILED" }, { status: "PENDING", lastError: { not: null } }] },
  "in-progress": { status: { in: ["PENDING", "SENT"] }, lastError: null },
  issued: { status: "ISSUED" },
  cancelled: { status: "CANCELLED" },
}

export type TaxInvoiceRow = {
  id: string
  number: number
  invoiceType: number
  status: "PENDING" | "SENT" | "ISSUED" | "FAILED" | "CANCELLED"
  kisanStatusLabel: string | null
  taxId: string | null
  lastError: string | null
  amount: string
  serviceName: string | null
  paymentReference: string
  orderId: string | null
  description: string
  buyerName: string | null
  completedAt: string | null
  checkedAt: string | null
  issuedAt: string | null
  canSend: boolean
  canCheck: boolean
}

export type TaxInvoicesWorkspace = {
  configured: boolean
  startsOn: string | null
  tab: TaxInvoiceTab
  counts: Record<TaxInvoiceTab, number>
  /** LIVE sales from the start date that have no invoice yet (mostly the 2-hour buyer wait). */
  waitingSales: number
  rows: TaxInvoiceRow[]
  services: Array<{
    id: string
    name: string
    slug: string
    taxStuffId: string | null
    registeredAt: string | null
  }>
}

export async function getTaxInvoicesWorkspace(tab: TaxInvoiceTab): Promise<TaxInvoicesWorkspace> {
  const db = getDb()
  const start = await invoicingStartsAt()
  const [counts, rows, services, waitingSales] = await Promise.all([
    Promise.all(TAX_INVOICE_TABS.map((key) => db.taxInvoice.count({ where: whereByTab[key] }))),
    db.taxInvoice.findMany({
      where: whereByTab[tab],
      orderBy: { number: tab === "attention" || tab === "in-progress" ? "asc" : "desc" },
      take: 200,
      include: {
        payment: {
          select: {
            reference: true,
            externalOrderId: true,
            amount: true,
            description: true,
            completedAt: true,
            invoiceBuyer: { select: { name: true } },
            service: { select: { name: true } },
          },
        },
      },
    }),
    db.connectedService.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, taxStuffId: true, taxStuffRegisteredAt: true },
    }),
    start
      ? db.payment.count({
          where: {
            environment: "LIVE",
            status: "COMPLETED",
            direction: "INCOMING",
            completedAt: { gte: start },
            taxInvoices: { none: { status: { not: "CANCELLED" } } },
          },
        })
      : Promise.resolve(0),
  ])

  return {
    configured: isKisanConfigured(),
    startsOn: start ? todayDateOnlyInTehran(start) : null,
    tab,
    counts: Object.fromEntries(
      TAX_INVOICE_TABS.map((key, index) => [key, counts[index]])
    ) as Record<TaxInvoiceTab, number>,
    waitingSales,
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      invoiceType: row.invoiceType,
      status: row.status,
      kisanStatusLabel:
        row.kisanStatus === null
          ? null
          : (KISAN_STATUS_LABELS[row.kisanStatus] ?? `Status ${row.kisanStatus}`),
      taxId: row.taxId,
      lastError: row.lastError,
      amount: row.payment.amount.toFixed(0),
      serviceName: row.payment.service?.name ?? null,
      paymentReference: row.payment.reference,
      orderId: row.payment.externalOrderId,
      description: row.payment.description,
      buyerName: row.payment.invoiceBuyer?.name ?? null,
      completedAt: row.payment.completedAt?.toISOString() ?? null,
      checkedAt: row.checkedAt?.toISOString() ?? null,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      canSend: row.status === "PENDING" || row.status === "FAILED",
      canCheck: row.status === "SENT" || (row.status === "FAILED" && row.trackingId !== null),
    })),
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      taxStuffId: service.taxStuffId,
      registeredAt: service.taxStuffRegisteredAt?.toISOString() ?? null,
    })),
  }
}

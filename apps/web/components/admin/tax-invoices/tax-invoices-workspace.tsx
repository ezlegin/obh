"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import {
  checkTaxInvoiceAction,
  registerServiceTaxStuffIdAction,
  resendTaxInvoiceAction,
  saveServiceTaxStuffIdAction,
  syncTaxInvoicesAction,
  type TaxInvoiceActionResult,
} from "@/app/admin/tax-invoices/actions"
import { formatIrrDecimal } from "@/lib/admin/format"
import type {
  TaxInvoiceRow,
  TaxInvoicesWorkspace as WorkspaceData,
  TaxInvoiceTab,
} from "@/server/tax-invoices/queries"

const TAB_LABELS: Record<TaxInvoiceTab, string> = {
  attention: "Needs attention",
  "in-progress": "In progress",
  issued: "Issued",
  cancelled: "Cancelled",
}

const STATUS_BADGES: Record<
  TaxInvoiceRow["status"],
  { label: string; variant: "warning" | "info" | "success" | "danger" | "muted" }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  SENT: { label: "At Kisan", variant: "info" },
  ISSUED: { label: "Issued", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tehran",
  dateStyle: "medium",
  timeStyle: "short",
})

function formatDateTime(value: string | null) {
  return value ? dateTime.format(new Date(value)) : "—"
}

function useAction() {
  const router = useRouter()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = (action: () => Promise<TaxInvoiceActionResult>) => {
    setNotice(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setNotice({ ok: false, text: result.error ?? "The operation could not be completed." })
        return
      }
      if (result.message) setNotice({ ok: true, text: result.message })
      router.refresh()
    })
  }

  return { notice, isPending, run }
}

function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null
  return (
    <p
      role={notice.ok ? "status" : "alert"}
      className={cn("mt-2 text-[11px] leading-5", notice.ok ? "text-muted-foreground" : "text-danger")}
    >
      {notice.text}
    </p>
  )
}

function ServiceRow({
  service,
  configured,
}: {
  service: WorkspaceData["services"][number]
  configured: boolean
}) {
  const { notice, isPending, run } = useAction()
  const [stuffId, setStuffId] = useState(service.taxStuffId ?? "")
  const changed = stuffId.trim() !== (service.taxStuffId ?? "")

  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium">{service.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {service.taxStuffId
              ? service.registeredAt
                ? `Registered at Kisan ${formatDateTime(service.registeredAt)}`
                : "Not registered at Kisan yet; its invoices wait."
              : "No service id: its sales are not invoiced."}
          </p>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => saveServiceTaxStuffIdAction({ serviceId: service.id, stuffId }))
          }}
        >
          <label className="sr-only" htmlFor={`stuff-${service.id}`}>
            13-digit service id for {service.name}
          </label>
          <Input
            id={`stuff-${service.id}`}
            value={stuffId}
            onChange={(event) => setStuffId(event.target.value)}
            inputMode="numeric"
            placeholder="13-digit service id"
            className="h-7 w-44 font-mono text-[11px]"
          />
          <Button type="submit" size="xs" variant="outline" disabled={isPending || !changed}>
            Save
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={isPending || !configured || !service.taxStuffId || changed}
            onClick={() => run(() => registerServiceTaxStuffIdAction({ serviceId: service.id }))}
          >
            {service.registeredAt ? "Register again" : "Register at Kisan"}
          </Button>
        </form>
      </div>
      <Notice notice={notice} />
    </li>
  )
}

function InvoiceActions({ row, configured }: { row: TaxInvoiceRow; configured: boolean }) {
  const { notice, isPending, run } = useAction()
  if (!configured || (!row.canSend && !row.canCheck)) return null
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {row.canCheck ? (
          <Button
            size="xs"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => checkTaxInvoiceAction({ invoiceId: row.id }))}
          >
            Check
          </Button>
        ) : null}
        {row.canSend ? (
          <Button
            size="xs"
            disabled={isPending}
            onClick={() => run(() => resendTaxInvoiceAction({ invoiceId: row.id }))}
          >
            {row.status === "FAILED" ? "Send again" : "Send now"}
          </Button>
        ) : null}
      </div>
      <Notice notice={notice} />
    </div>
  )
}

export function TaxInvoicesWorkspace({ data }: { data: WorkspaceData }) {
  const sync = useAction()

  return (
    <>
      {!data.configured || !data.startsOn ? (
        <p className="mt-8 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs leading-5 text-warning">
          {!data.configured
            ? "Sending is off: set KISAN_API_URL, KISAN_USERNAME, KISAN_PASSWORD and KISAN_ECONOMIC_CODE on the server (Kisan's support issues the web-service user)."
            : "Sending is off until the VAT registration date is set in Admin → VAT."}
        </p>
      ) : null}

      <section aria-labelledby="services-heading" className="mt-8 rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="services-heading" className="text-sm font-medium">
              Service ids
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground">
              Each service&apos;s sales are invoiced under its 13-digit goods/service id
              (stuffid.tax.gov.ir), e.g. 2330001423071 «خدمات ابری» for Afarin. Register it at Kisan
              once before its first invoice.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Button
              size="sm"
              disabled={sync.isPending || !data.configured || !data.startsOn}
              onClick={() => sync.run(() => syncTaxInvoicesAction())}
            >
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>
            <Notice notice={sync.notice} />
          </div>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {data.services.map((service) => (
            <ServiceRow key={service.id} service={service} configured={data.configured} />
          ))}
        </ul>
      </section>

      <nav aria-label="Invoice status" className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(TAB_LABELS) as TaxInvoiceTab[]).map((tab) => (
          <Link
            key={tab}
            href={tab === "attention" ? "/admin/tax-invoices" : `/admin/tax-invoices?tab=${tab}`}
            aria-current={data.tab === tab ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
              data.tab === tab
                ? "border-white/20 bg-white/[0.07] text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {TAB_LABELS[tab]} · {data.counts[tab]}
          </Link>
        ))}
      </nav>

      {data.tab === "in-progress" && data.waitingSales > 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {data.waitingSales} recent sale{data.waitingSales === 1 ? "" : "s"} without an invoice yet:
          sales wait 2 hours for the service to send buyer details, then get a type-2 invoice.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[56rem] text-xs">
          <caption className="sr-only">{TAB_LABELS[data.tab]} invoices</caption>
          <thead className="bg-white/[0.02] text-left text-[11px] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Invoice</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Sale</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Amount</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nothing here.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono">#{row.number}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Type {row.invoiceType}
                      {row.buyerName ? ` · ${row.buyerName}` : ""}
                    </p>
                  </td>
                  <td className="max-w-72 px-4 py-3">
                    <p className="truncate">{row.serviceName ?? "Unassigned service"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.description}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {row.paymentReference} · {formatDateTime(row.completedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {formatIrrDecimal(row.amount)}
                  </td>
                  <td className="max-w-80 px-4 py-3">
                    <Badge variant={STATUS_BADGES[row.status].variant}>
                      {STATUS_BADGES[row.status].label}
                    </Badge>
                    {row.kisanStatusLabel ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Kisan: {row.kisanStatusLabel}
                      </p>
                    ) : null}
                    {row.taxId ? (
                      <p className="mt-1 font-mono text-[10px] select-all">{row.taxId}</p>
                    ) : null}
                    {row.lastError ? (
                      <p className="mt-1 text-[11px] leading-5 text-danger">{row.lastError}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {row.issuedAt
                        ? `Issued ${formatDateTime(row.issuedAt)}`
                        : row.checkedAt
                          ? `Checked ${formatDateTime(row.checkedAt)}`
                          : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <InvoiceActions row={row} configured={data.configured} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

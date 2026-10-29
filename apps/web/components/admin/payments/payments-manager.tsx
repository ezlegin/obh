"use client"

import {
  ArrowUpRight,
  CreditCard,
  Eye,
  Loader2,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { PaymentDetailDialog } from "@/components/admin/payments/payment-detail-dialog"
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge"
import {
  deleteAllTestPaymentsAction,
  deletePaymentAction,
} from "@/app/admin/payments/actions"
import { formatDevelopmentDate, formatIrrDecimal } from "@/lib/admin/format"
import type { AdminPayment } from "@/server/payments/queries"

type EnvironmentFilter = "LIVE" | "TEST" | "ALL"

type PaymentsManagerProps = {
  payments: AdminPayment[]
}

function PaymentsManager({ payments }: PaymentsManagerProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [environmentFilter, setEnvironmentFilter] =
    useState<EnvironmentFilter>("LIVE")
  const [detailPayment, setDetailPayment] = useState<AdminPayment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingTest, setClearingTest] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const removePayment = async (payment: AdminPayment) => {
    if (
      !window.confirm(
        `Remove payment ${payment.reference}? This cannot be undone.`
      )
    ) {
      return
    }

    setDeletingId(payment.id)
    setError(null)

    const result = await deletePaymentAction({ paymentId: payment.id })

    if (!result.ok) {
      setError(result.error ?? "The payment could not be removed.")
    } else {
      if (detailPayment?.id === payment.id) {
        setDetailPayment(null)
      }
      router.refresh()
    }

    setDeletingId(null)
  }

  const removeAllTestPayments = async () => {
    if (
      !window.confirm(
        `Remove all ${counts.test} TEST payment${counts.test === 1 ? "" : "s"}, including their events, verifications and installment schedules? LIVE payments are not affected. This cannot be undone.`
      )
    ) {
      return
    }

    setClearingTest(true)
    setError(null)

    const result = await deleteAllTestPaymentsAction()

    if (!result.ok) {
      setError(result.error ?? "The test payments could not be removed.")
    } else {
      if (detailPayment?.environment === "TEST") {
        setDetailPayment(null)
      }
      router.refresh()
    }

    setClearingTest(false)
  }

  const counts = useMemo(() => {
    let live = 0
    let test = 0
    for (const payment of payments) {
      if (payment.environment === "LIVE") {
        live += 1
      } else {
        test += 1
      }
    }
    return { live, test, all: payments.length }
  }, [payments])

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase()

    return payments.filter((payment) => {
      if (
        environmentFilter !== "ALL" &&
        payment.environment !== environmentFilter
      ) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        payment.reference,
        payment.gatewayOrderId,
        payment.description,
        payment.serviceName,
        payment.externalOrderId,
        payment.providerReference,
        payment.traceNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [payments, environmentFilter, search])

  const columns: DataTableColumn<AdminPayment>[] = [
    {
      id: "reference",
      header: "Payment",
      sortValue: (payment) => payment.reference,
      cell: (payment) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] text-foreground">
              {payment.reference}
            </p>
            <Badge
              variant={payment.environment === "TEST" ? "warning" : "success"}
            >
              {payment.environment}
            </Badge>
          </div>
          <p className="mt-1 max-w-64 truncate text-[11px] text-muted-foreground">
            {payment.description}
          </p>
          <p className="mt-1 max-w-64 truncate font-mono text-[9px] text-muted-foreground/55">
            Sadad OrderId: {payment.gatewayOrderId}
            {payment.externalOrderId ? ` · ${payment.externalOrderId}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "service",
      header: "Service & Receipt",
      sortValue: (payment) => payment.serviceName ?? "",
      cell: (payment) => (
        <div>
          <p className="text-xs">{payment.serviceName ?? "—"}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {payment.traceNumber
              ? `Trace ${payment.traceNumber} · Ref ${payment.providerReference ?? "—"}`
              : (payment.providerName ?? "Sadad (Bank Melli)")}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (payment) => <PaymentStatusBadge status={payment.status} />,
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (payment) => Number(payment.amount),
      cell: (payment) => (
        <span className="text-xs font-medium">
          {formatIrrDecimal(payment.amount)}
        </span>
      ),
    },
    {
      id: "date",
      header: "Created",
      align: "right",
      sortValue: (payment) => payment.createdAt,
      cell: (payment) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatDevelopmentDate(payment.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (payment) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`View payment ${payment.reference}`}
            onClick={() => setDetailPayment(payment)}
          >
            <Eye aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove payment ${payment.reference}`}
            onClick={() => removePayment(payment)}
            disabled={deletingId === payment.id}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {deletingId === payment.id ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-card/40",
          "mt-8"
        )}
      >
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Payment records
            </p>
            <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">
              Transactions
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter payments by environment"
              className="inline-flex items-center rounded-xl border border-border bg-white/[0.02] p-0.5"
            >
              {(
                [
                  { id: "LIVE" as const, label: "Live", count: counts.live },
                  { id: "TEST" as const, label: "Test", count: counts.test },
                  { id: "ALL" as const, label: "All", count: counts.all },
                ] as const
              ).map((option) => {
                const active = environmentFilter === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setEnvironmentFilter(option.id)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        "font-mono text-[10px] tabular-nums",
                        active
                          ? "text-background/75"
                          : "text-muted-foreground/60"
                      )}
                    >
                      {option.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={removeAllTestPayments}
              disabled={clearingTest || counts.test === 0}
              className="text-danger hover:bg-danger/10 hover:text-danger"
            >
              {clearingTest ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="size-3.5" />
              )}
              Remove test payments
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground/60"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, OrderId, trace..."
              aria-label="Search payments"
              className="h-10 pl-9 text-xs"
            />
          </div>
          <span className="inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.06em] text-muted-foreground/55 uppercase">
            <ShieldCheck aria-hidden="true" className="size-3" />
            Click any payment to view full details
          </span>
        </div>

        <DataTable
          rows={filteredPayments}
          columns={columns}
          getRowId={(payment) => payment.id}
          onRowClick={(payment) => setDetailPayment(payment)}
          caption="OBH Sadad payment records"
          defaultSort={{ columnId: "date", direction: "desc" }}
          minWidthClassName="min-w-[50rem]"
          emptyState={
            <AdminEmptyState
              icon={search ? SearchX : CreditCard}
              title={
                search
                  ? "No payments match your search"
                  : environmentFilter !== "ALL"
                    ? `No ${environmentFilter.toLowerCase()} payments recorded`
                    : "No payment records yet"
              }
              description={
                search
                  ? "Clear the search to see recorded payments."
                  : environmentFilter === "LIVE" && counts.test > 0
                    ? `There are ${counts.test} test payment${counts.test === 1 ? "" : "s"} recorded. Switch the filter to Test or All to view them.`
                    : "Payments appear here when a connected service reports them with @obhco/pay."
              }
              action={
                search ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </Button>
                ) : environmentFilter === "LIVE" && counts.test > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEnvironmentFilter("ALL")}
                  >
                    Show all payments ({counts.all})
                  </Button>
                ) : null
              }
            />
          }
        />
      </div>

      <PaymentDetailDialog
        payment={detailPayment}
        onOpenChange={(open) => {
          if (!open) {
            setDetailPayment(null)
          }
        }}
        onDelete={(payment) => removePayment(payment)}
        deleting={Boolean(detailPayment && deletingId === detailPayment.id)}
      />
    </>
  )
}

export { PaymentsManager }

"use client"

import {
  ArrowUpRight,
  CreditCard,
  Landmark,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { CreatePaymentDialog } from "@/components/admin/payments/create-payment-dialog"
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge"
import { SimulateResultDialog } from "@/components/admin/payments/simulate-result-dialog"
import { formatDevelopmentDate, formatIrrDecimal } from "@/lib/admin/format"
import type { AdminPayment } from "@/server/payments/queries"

type PaymentServiceOption = {
  id: string
  name: string
  domain: string
}

type PaymentsManagerProps = {
  payments: AdminPayment[]
  services: PaymentServiceOption[]
}

function PaymentsManager({ payments, services }: PaymentsManagerProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(
    null
  )

  const canCreate = services.length > 0

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return payments
    }

    return payments.filter((payment) =>
      [
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
    )
  }, [payments, search])

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
      cell: (payment) =>
        payment.status === "PENDING" && payment.environment === "TEST" ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setSelectedPayment(payment)}
          >
            Simulate
          </Button>
        ) : (
          <span className="font-mono text-[9px] text-muted-foreground/45">
            {payment.eventCount} events
          </span>
        ),
    },
  ]

  return (
    <>
      <div className="mt-8 rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-info">
            <Landmark aria-hidden="true" className="size-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium">
                Sadad (Bank Melli Iran) payment ledger
              </p>
              <Badge variant="outline">Single gateway</Badge>
            </div>
            <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-muted-foreground">
              All service payments are processed through Sadad IPG using whole
              Rial amounts, TripleDES <code className="font-mono">SignData</code>
              , and server-side <code className="font-mono">Advice/Verify</code>
              . Pending <code className="font-mono">TEST</code> payments can also
              be simulated directly from this console.
            </p>
          </div>
        </div>
      </div>

      {!canCreate ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-card/40 p-5 md:grid-cols-2">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground/60 uppercase">
              Setup required
            </p>
            <p className="mt-2 text-sm font-medium">
              Register at least one active connected service before creating a
              test payment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Link
              href="/admin/services"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Manage services
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Payment records
            </p>
            <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">
              Transactions
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{payments.length} records</Badge>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!canCreate}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              New test payment
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
            Verified via Sadad Advice/Verify
          </span>
        </div>

        <DataTable
          rows={filteredPayments}
          columns={columns}
          getRowId={(payment) => payment.id}
          caption="OBH Sadad payment records"
          defaultSort={{ columnId: "date", direction: "desc" }}
          minWidthClassName="min-w-[50rem]"
          emptyState={
            <AdminEmptyState
              icon={search ? SearchX : CreditCard}
              title={
                search
                  ? "No payments match your search"
                  : "No payment records yet"
              }
              description={
                search
                  ? "Clear the search to see all recorded payments."
                  : canCreate
                    ? "Create a TEST payment or initiate one from a connected service via @obh/payments."
                    : "Register a connected service first."
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
                ) : canCreate ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Create test payment
                  </Button>
                ) : null
              }
            />
          }
        />
      </div>

      {canCreate ? (
        <CreatePaymentDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          services={services}
          onCreated={() => router.refresh()}
        />
      ) : null}

      <SimulateResultDialog
        payment={selectedPayment}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPayment(null)
          }
        }}
        onCompleted={() => router.refresh()}
      />
    </>
  )
}

export { PaymentsManager }

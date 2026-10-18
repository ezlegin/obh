"use client"

import {
  ArrowUpRight,
  CreditCard,
  FlaskConical,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { CreatePaymentDialog } from "@/components/admin/payments/create-payment-dialog"
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge"
import { SimulateResultDialog } from "@/components/admin/payments/simulate-result-dialog"
import type { AdminPayment } from "@/server/payments/queries"
import { formatDevelopmentDate, formatIrrDecimal } from "@/lib/admin/format"

type PaymentServiceOption = {
  id: string
  name: string
  domain: string
}

type PaymentAccountOption = {
  id: string
  name: string
  providerName: string
}

type PaymentsManagerProps = {
  payments: AdminPayment[]
  services: PaymentServiceOption[]
  accounts: PaymentAccountOption[]
}

function PaymentsManager({
  payments,
  services,
  accounts,
}: PaymentsManagerProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(
    null
  )

  const canCreate = services.length > 0 && accounts.length > 0

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return payments
    }

    return payments.filter((payment) =>
      [
        payment.reference,
        payment.description,
        payment.serviceName,
        payment.externalOrderId,
        payment.providerReference,
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
          {payment.externalOrderId ? (
            <p className="mt-1 max-w-64 truncate font-mono text-[9px] text-muted-foreground/50">
              {payment.externalOrderId}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "service",
      header: "Service",
      sortValue: (payment) => payment.serviceName ?? "",
      cell: (payment) => (
        <div>
          <p className="text-xs">{payment.serviceName ?? "—"}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {payment.providerName ?? "No provider"}
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
        payment.status === "PENDING" &&
        payment.environment === "TEST" &&
        payment.providerCode === "development" ? (
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
      <div className="mt-8 rounded-2xl border border-warning/20 bg-warning/[0.04] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-warning/20 bg-warning/10 text-warning">
            <FlaskConical aria-hidden="true" className="size-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium">Development payment console</p>
              <Badge variant="warning">TEST only</Badge>
            </div>
            <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-muted-foreground">
              These are real OBH payment records created in TEST environment
              through the development adapter. No real provider is contacted, no
              redirect is involved, and no value is moved.
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
              Register a service and create a TEST provider account before
              creating payments.
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Services: {services.length} active · Development accounts:{" "}
              {accounts.length} active
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
            <Link
              href="/admin/gateways"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Configure gateway
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
              Test transactions
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
              placeholder="Search payments"
              aria-label="Search payments"
              className="h-10 pl-9 text-xs"
            />
          </div>
          <span className="inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.06em] text-muted-foreground/55 uppercase">
            <ShieldCheck aria-hidden="true" className="size-3" />
            Server-recorded lifecycle
          </span>
        </div>

        <DataTable
          rows={filteredPayments}
          columns={columns}
          getRowId={(payment) => payment.id}
          caption="OBH test payment records"
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
                  ? "Clear the search to see all recorded test payments."
                  : canCreate
                    ? "Create a TEST payment to exercise the payment lifecycle through the development adapter."
                    : "Complete the service and development gateway setup first."
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

      <p className="mt-5 text-[10px] leading-5 text-muted-foreground/55">
        External initiation and the versioned service API are defined in the
        payment API contract and will be implemented after this foundation. The
        admin console is the only initiation path in this step.
      </p>

      {canCreate ? (
        <CreatePaymentDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          services={services}
          accounts={accounts}
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

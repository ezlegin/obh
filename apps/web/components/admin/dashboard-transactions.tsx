"use client"

import { Eye, Search, SearchX, SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { TransactionDetailDialog } from "@/components/admin/transaction-detail-dialog"
import { TransactionFilterDialog } from "@/components/admin/transaction-filter-dialog"
import { TransactionStatusBadge } from "@/components/admin/transaction-status-badge"
import {
  countActiveDashboardFilters,
  defaultDashboardFilters,
  type DashboardFilters,
} from "@/lib/admin/dashboard-filters"
import { formatDevelopmentDate, formatIrr } from "@/lib/admin/format"
import type { DashboardTransaction } from "@/server/dashboard/queries"

type DashboardTransactionsProps = {
  transactions: readonly DashboardTransaction[]
  serviceNames: readonly string[]
}

function DashboardTransactions({
  transactions,
  serviceNames,
}: DashboardTransactionsProps) {
  const [filters, setFilters] = useState<DashboardFilters>(
    defaultDashboardFilters
  )
  const [search, setSearch] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<DashboardTransaction | null>(null)

  const activeFilterCount = countActiveDashboardFilters(filters)

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return transactions.filter((transaction) => {
      if (filters.status !== "all" && transaction.status !== filters.status) {
        return false
      }

      if (
        filters.service !== "all" &&
        transaction.service !== filters.service
      ) {
        return false
      }

      const dateKey = transaction.occurredAt.slice(0, 10)

      if (filters.from && dateKey < filters.from) {
        return false
      }

      if (filters.to && dateKey > filters.to) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        transaction.reference,
        transaction.service,
        transaction.description,
        transaction.externalOrderId,
        transaction.provider,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [transactions, filters, search])

  const clearAllFilters = () => {
    setFilters(defaultDashboardFilters)
    setSearch("")
  }

  const columns: DataTableColumn<DashboardTransaction>[] = [
    {
      id: "reference",
      header: "Reference",
      sortValue: (transaction) => transaction.reference,
      cell: (transaction) => (
        <div>
          <p className="font-mono text-[11px] text-foreground">
            {transaction.reference}
          </p>
          <p className="mt-1 max-w-56 truncate text-[11px] text-muted-foreground">
            {transaction.description}
          </p>
        </div>
      ),
    },
    {
      id: "service",
      header: "Service",
      sortValue: (transaction) => transaction.service,
      cell: (transaction) => (
        <span className="text-xs text-muted-foreground">
          {transaction.service}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (transaction) => (
        <TransactionStatusBadge status={transaction.status} />
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (transaction) => transaction.amount,
      cell: (transaction) => (
        <span className="text-xs font-medium">
          {formatIrr(transaction.amount)}
        </span>
      ),
    },
    {
      id: "date",
      header: "Date",
      align: "right",
      sortValue: (transaction) => transaction.occurredAt,
      cell: (transaction) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatDevelopmentDate(transaction.occurredAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (transaction) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`View payment ${transaction.reference}`}
          onClick={() => setSelectedTransaction(transaction)}
        >
          <Eye aria-hidden="true" className="size-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <section aria-labelledby="recent-payments-heading">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Transactions
            </p>
            <h2
              id="recent-payments-heading"
              className="mt-2 text-xl font-medium tracking-[-0.025em]"
            >
              Recent payments
            </h2>
          </div>
          <Badge variant="outline">{transactions.length} recorded</Badge>
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
              placeholder="Search reference, order ID, or service"
              aria-label="Search transactions"
              className="h-10 pl-9 text-xs"
            />
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="font-mono text-[9px] tracking-[0.08em] text-muted-foreground/55 uppercase">
              {filteredTransactions.length} of {transactions.length} payments
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFilterOpen(true)}
            >
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] text-background">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        <p className="border-b border-border px-4 py-2 text-[10px] text-muted-foreground/55 sm:hidden">
          Swipe horizontally to view all columns.
        </p>

        <DataTable
          rows={filteredTransactions}
          columns={columns}
          getRowId={(transaction) => transaction.id}
          caption="Recent payments recorded in the OBH database"
          defaultSort={{ columnId: "date", direction: "desc" }}
          minWidthClassName="min-w-[36rem] sm:min-w-[44rem]"
          emptyState={
            <AdminEmptyState
              icon={SearchX}
              title={
                transactions.length === 0
                  ? "No payments recorded yet"
                  : "No payments match your filters"
              }
              description={
                transactions.length === 0
                  ? "Payments created via the SDK or admin console will appear here immediately."
                  : "Adjust the search term or filters to view matching payments."
              }
              action={
                transactions.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                  >
                    Clear search and filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>

      <TransactionFilterDialog
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        initialFilters={filters}
        serviceNames={serviceNames}
        onApply={setFilters}
      />
      <TransactionDetailDialog
        transaction={selectedTransaction}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTransaction(null)
          }
        }}
      />
    </section>
  )
}

export { DashboardTransactions }

"use client"

import {
  CircleDollarSign,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  WalletCards,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { CreateIncomeDialog } from "@/components/admin/income/create-income-dialog"
import { deleteIncomeAction } from "@/app/admin/income/actions"
import type { AdminIncome, IncomeWorkspace } from "@/server/accounting/queries"
import { formatAccountingDate, formatIrrDecimal } from "@/lib/admin/format"

function IncomeWorkspace({ data }: { data: IncomeWorkspace }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<AdminIncome | null>(null)
  const [search, setSearch] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const removeIncome = async (income: AdminIncome) => {
    if (
      !window.confirm(
        `Remove income "${income.description}"? This will also deduct it from the business balance.`
      )
    ) {
      return
    }

    setPendingId(income.id)
    setError(null)

    const result = await deleteIncomeAction({ incomeId: income.id })

    if (!result.ok) {
      setError(result.error ?? "The income record could not be removed.")
    } else {
      router.refresh()
    }

    setPendingId(null)
  }

  const filteredIncomes = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return data.incomes
    }

    return data.incomes.filter((income) =>
      [
        income.description,
        income.source,
        income.accountName,
        income.serviceName,
        income.externalReference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  }, [data.incomes, search])

  const columns: DataTableColumn<AdminIncome>[] = [
    {
      id: "income",
      header: "Income",
      sortValue: (income) => income.description,
      cell: (income) => (
        <div>
          <p className="text-xs font-medium">{income.description}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {income.source ?? "No source label"}
          </p>
          {income.externalReference ? (
            <p className="mt-1 font-mono text-[9px] text-muted-foreground/50">
              {income.externalReference}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "date",
      header: "Received",
      sortValue: (income) => income.receivedOn,
      cell: (income) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatAccountingDate(income.receivedOn)}
        </span>
      ),
    },
    {
      id: "account",
      header: "Payment source",
      cell: (income) => (
        <span className="text-[11px] text-muted-foreground">
          {income.accountName ?? "Not assigned"}
        </span>
      ),
    },
    {
      id: "service",
      header: "Service",
      cell: (income) => (
        <span className="text-[11px] text-muted-foreground">
          {income.serviceName ?? "Corporate"}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (income) => Number(income.amount),
      cell: (income) => (
        <span className="text-xs font-medium text-success tabular-nums">
          +{formatIrrDecimal(income.amount)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (income) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit ${income.description}`}
            onClick={() => setEditingIncome(income)}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${income.description}`}
            onClick={() => removeIncome(income)}
            disabled={pendingId === income.id}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {pendingId === income.id ? (
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
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingStat
          label="Business balance"
          value={formatIrrDecimal(data.summary.totalBusinessBalance)}
          hint={`Includes ${formatIrrDecimal(data.summary.completedPaymentsAllTime)} from completed payments plus recorded income, minus expenses.`}
          icon={Wallet}
        />
        <AccountingStat
          label="Received this month"
          value={formatIrrDecimal(data.summary.receivedThisMonth)}
          hint="Additional income with a received date in the current month."
          icon={CircleDollarSign}
        />
        <AccountingStat
          label="Received all time"
          value={formatIrrDecimal(data.summary.receivedAllTime)}
          hint="All recorded additional income added to the business balance."
          icon={WalletCards}
        />
        <AccountingStat
          label="Income records"
          value={String(data.summary.incomeCount)}
          hint={`${data.summary.thisMonthCount} recorded this month.`}
          icon={Landmark}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      {data.accounts.length === 0 ? (
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
          No business payment source exists yet. Income can be recorded, but it
          cannot be linked to an account until one is added.{" "}
          <Link
            href="/admin/accounts"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Manage payment sources
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground/60 uppercase">
              Additional income
            </p>
            <p className="mt-2 text-sm font-medium">
              {data.incomes.length}{" "}
              {data.incomes.length === 1 ? "record" : "records"}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-3.5" />
            Record income
          </Button>
        </div>

        <div className="border-b border-border p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground/60"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search income"
              aria-label="Search income"
              className="h-10 pl-9 text-xs"
            />
          </div>
        </div>

        <DataTable
          rows={filteredIncomes}
          columns={columns}
          getRowId={(income) => income.id}
          caption="Additional income records"
          defaultSort={{ columnId: "date", direction: "desc" }}
          minWidthClassName="min-w-[46rem]"
          emptyState={
            <AdminEmptyState
              icon={CircleDollarSign}
              title={
                data.incomes.length === 0
                  ? "No income records yet"
                  : "No income matches your search"
              }
              description={
                data.incomes.length === 0
                  ? "Record additional business income here. Incoming payment transactions and shareholder capital remain separate."
                  : "Clear the search to see all income records."
              }
              action={
                data.incomes.length === 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Record first income
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </Button>
                )
              }
            />
          }
        />
      </div>

      <p className="mt-4 text-[10px] leading-5 text-muted-foreground/55">
        Both completed gateway payments and recorded income directly increase
        the business balance.
      </p>

      <CreateIncomeDialog
        open={createOpen || Boolean(editingIncome)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditingIncome(null)
          }
        }}
        accounts={data.accounts}
        services={data.services}
        income={editingIncome}
        onCreated={() => {
          setCreateOpen(false)
          setEditingIncome(null)
          router.refresh()
        }}
      />
    </>
  )
}

export { IncomeWorkspace }

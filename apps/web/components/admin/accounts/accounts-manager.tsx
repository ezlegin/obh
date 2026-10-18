"use client"

import { Building2, Landmark, Loader2, Plus, Power } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { CreateBusinessAccountDialog } from "@/components/admin/accounts/create-account-dialog"
import { toggleBusinessAccountAction } from "@/app/admin/accounts/actions"
import type { AdminBusinessAccount } from "@/server/accounting/queries"
import { formatAccountingDate, formatIrrDecimal } from "@/lib/admin/format"

function AccountsManager({ accounts }: { accounts: AdminBusinessAccount[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleAccount = async (account: AdminBusinessAccount) => {
    setPendingId(account.id)
    setError(null)

    const result = await toggleBusinessAccountAction({
      accountId: account.id,
      isActive: !account.isActive,
    })

    if (!result.ok) {
      setError(result.error ?? "The account status could not be changed.")
    } else {
      router.refresh()
    }

    setPendingId(null)
  }

  const columns: DataTableColumn<AdminBusinessAccount>[] = [
    {
      id: "account",
      header: "Payment source",
      sortValue: (account) => account.name,
      cell: (account) => (
        <div>
          <p className="text-xs font-medium">{account.name}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {account.institution ?? "No institution recorded"}
            {account.maskedIdentifier ? ` · ${account.maskedIdentifier}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "opening",
      header: "Opening balance",
      align: "right",
      sortValue: (account) => Number(account.openingBalance),
      cell: (account) => (
        <div>
          <p className="text-xs">{formatIrrDecimal(account.openingBalance)}</p>
          <p className="mt-1 text-[9px] text-muted-foreground">
            {account.openingBalanceAt
              ? formatAccountingDate(account.openingBalanceAt)
              : "No date"}
          </p>
        </div>
      ),
    },
    {
      id: "records",
      header: "Records",
      align: "right",
      cell: (account) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {account.expenseCount}{" "}
          {account.expenseCount === 1 ? "expense" : "expenses"} ·{" "}
          {account.incomeCount} income
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (account) => (
        <Badge variant={account.isActive ? "success" : "muted"}>
          {account.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (account) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => toggleAccount(account)}
          disabled={pendingId === account.id}
        >
          {pendingId === account.id ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Power aria-hidden="true" className="size-3.5" />
          )}
          {account.isActive ? "Deactivate" : "Activate"}
        </Button>
      ),
    },
  ]

  return (
    <>
      <div className="mt-8 rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-info">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium">Business accounts only</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              These payment sources are used by income and expense records.
              Gateway provider accounts remain under{" "}
              <span className="text-foreground">Gateways</span> and are never
              used as general accounting sources here.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground/60 uppercase">
              Payment sources
            </p>
            <p className="mt-2 text-sm font-medium">
              {accounts.filter((account) => account.isActive).length} active
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-3.5" />
            Add payment source
          </Button>
        </div>

        <DataTable
          rows={accounts}
          columns={columns}
          getRowId={(account) => account.id}
          caption="Business payment sources"
          defaultSort={{ columnId: "account", direction: "asc" }}
          minWidthClassName="min-w-[46rem]"
          emptyState={
            <AdminEmptyState
              icon={Landmark}
              title="No business payment sources yet"
              description="Add the bank, cash, or wallet accounts used for income and expenses. No provider account is created here."
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  Add the first source
                </Button>
              }
            />
          }
        />
      </div>

      <CreateBusinessAccountDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => router.refresh()}
      />
    </>
  )
}

export { AccountsManager }

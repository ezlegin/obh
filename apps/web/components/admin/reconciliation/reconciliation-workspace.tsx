"use client"

import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Landmark,
  Loader2,
  Pencil,
  Receipt,
  Scale,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { RecordFeeDialog } from "@/components/admin/reconciliation/record-fee-dialog"
import { RecordReconciliationDialog } from "@/components/admin/reconciliation/record-reconciliation-dialog"
import { RecordSettlementDialog } from "@/components/admin/reconciliation/record-settlement-dialog"
import {
  deleteProviderFeeAction,
  deleteReconciliationAction,
  deleteSettlementAction,
} from "@/app/admin/reconciliation/actions"
import type {
  ProviderAccountBalanceView,
  ProviderFeeView,
  ReconciliationView,
  ReconciliationWorkspace,
  SettlementView,
} from "@/server/reconciliation/queries"
import { formatAccountingDate, formatIrrDecimal } from "@/lib/admin/format"

function ReconciliationWorkspace({ data }: { data: ReconciliationWorkspace }) {
  const router = useRouter()
  const [feeTarget, setFeeTarget] = useState<ProviderAccountBalanceView | null>(
    null
  )
  const [settlementTarget, setSettlementTarget] =
    useState<ProviderAccountBalanceView | null>(null)
  const [reconciliationTarget, setReconciliationTarget] =
    useState<ProviderAccountBalanceView | null>(null)
  const [editingFee, setEditingFee] = useState<ProviderFeeView | null>(null)
  const [editingSettlement, setEditingSettlement] =
    useState<SettlementView | null>(null)
  const [editingReconciliation, setEditingReconciliation] =
    useState<ReconciliationView | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accountById = (accountId: string) =>
    data.accounts.find((account) => account.id === accountId) ?? null

  const refresh = () => router.refresh()

  const removeFee = async (fee: ProviderFeeView) => {
    if (!window.confirm("Remove this provider fee?")) {
      return
    }
    setPendingKey(`fee:${fee.id}`)
    setError(null)
    const result = await deleteProviderFeeAction({ feeId: fee.id })
    if (!result.ok) {
      setError(result.error ?? "The fee could not be removed.")
    } else {
      refresh()
    }
    setPendingKey(null)
  }

  const removeSettlement = async (settlement: SettlementView) => {
    if (!window.confirm(`Remove settlement ${settlement.reference}?`)) {
      return
    }
    setPendingKey(`settlement:${settlement.id}`)
    setError(null)
    const result = await deleteSettlementAction({ transferId: settlement.id })
    if (!result.ok) {
      setError(result.error ?? "The settlement could not be removed.")
    } else {
      refresh()
    }
    setPendingKey(null)
  }

  const removeReconciliation = async (reconciliation: ReconciliationView) => {
    if (!window.confirm("Remove this reconciliation snapshot?")) {
      return
    }
    setPendingKey(`reconciliation:${reconciliation.id}`)
    setError(null)
    const result = await deleteReconciliationAction({
      reconciliationId: reconciliation.id,
    })
    if (!result.ok) {
      setError(result.error ?? "The reconciliation could not be removed.")
    } else {
      refresh()
    }
    setPendingKey(null)
  }

  const feeColumns: DataTableColumn<ProviderFeeView>[] = [
    {
      id: "date",
      header: "Charged",
      sortValue: (fee) => fee.chargedAt,
      cell: (fee) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatAccountingDate(fee.chargedAt)}
        </span>
      ),
    },
    {
      id: "account",
      header: "Provider account",
      cell: (fee) => (
        <div>
          <p className="text-xs">{fee.providerAccountName}</p>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
            {fee.paymentReference ?? "No linked payment"}
          </p>
        </div>
      ),
    },
    {
      id: "kind",
      header: "Kind",
      cell: (fee) => (
        <span className="text-[11px] text-muted-foreground">
          {fee.kind === "GATEWAY_FEE" ? "Gateway fee" : "Commission"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (fee) => (
        <Badge variant={fee.status === "SETTLED" ? "success" : "warning"}>
          {fee.status}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (fee) => Number(fee.amount),
      cell: (fee) => (
        <span className="text-xs font-medium tabular-nums">
          {formatIrrDecimal(fee.amount)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (fee) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Edit provider fee"
            onClick={() => setEditingFee(fee)}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Remove provider fee"
            onClick={() => removeFee(fee)}
            disabled={pendingKey === `fee:${fee.id}`}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {pendingKey === `fee:${fee.id}` ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  const settlementColumns: DataTableColumn<SettlementView>[] = [
    {
      id: "date",
      header: "Settled",
      sortValue: (settlement) => settlement.occurredAt,
      cell: (settlement) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatAccountingDate(settlement.occurredAt)}
        </span>
      ),
    },
    {
      id: "route",
      header: "Movement",
      cell: (settlement) => (
        <div>
          <p className="text-xs">
            {settlement.fromAccountName} → {settlement.toAccountName}
          </p>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
            {settlement.externalReference ?? settlement.reference}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (settlement) => (
        <Badge
          variant={settlement.status === "COMPLETED" ? "success" : "warning"}
        >
          {settlement.status}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (settlement) => Number(settlement.amount),
      cell: (settlement) => (
        <span className="text-xs font-medium tabular-nums">
          {formatIrrDecimal(settlement.amount)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (settlement) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit settlement ${settlement.reference}`}
            onClick={() => setEditingSettlement(settlement)}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove settlement ${settlement.reference}`}
            onClick={() => removeSettlement(settlement)}
            disabled={pendingKey === `settlement:${settlement.id}`}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {pendingKey === `settlement:${settlement.id}` ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  const reconciliationColumns: DataTableColumn<ReconciliationView>[] = [
    {
      id: "date",
      header: "As of",
      sortValue: (reconciliation) => reconciliation.asOf,
      cell: (reconciliation) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatAccountingDate(reconciliation.asOf)}
        </span>
      ),
    },
    {
      id: "account",
      header: "Account",
      cell: (reconciliation) => (
        <span className="text-xs">{reconciliation.accountName}</span>
      ),
    },
    {
      id: "actual",
      header: "Actual",
      align: "right",
      cell: (reconciliation) => (
        <span className="text-xs tabular-nums">
          {formatIrrDecimal(reconciliation.actualBalance)}
        </span>
      ),
    },
    {
      id: "calculated",
      header: "Calculated",
      align: "right",
      cell: (reconciliation) => (
        <span className="text-xs tabular-nums">
          {formatIrrDecimal(reconciliation.calculatedBalance)}
        </span>
      ),
    },
    {
      id: "difference",
      header: "Difference",
      align: "right",
      cell: (reconciliation) => (
        <span
          className={
            reconciliation.difference === "0.00"
              ? "text-xs text-success tabular-nums"
              : "text-xs text-danger tabular-nums"
          }
        >
          {formatIrrDecimal(reconciliation.difference)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (reconciliation) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Edit reconciliation"
            onClick={() => setEditingReconciliation(reconciliation)}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Remove reconciliation"
            onClick={() => removeReconciliation(reconciliation)}
            disabled={pendingKey === `reconciliation:${reconciliation.id}`}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {pendingKey === `reconciliation:${reconciliation.id}` ? (
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
          label="Provider accounts"
          value={String(data.summary.providerAccounts)}
          hint={`${data.summary.liveAccounts} live · ${data.summary.testAccounts} test`}
          icon={Landmark}
        />
        <AccountingStat
          label="Accounts with difference"
          value={String(data.summary.accountsWithDifference)}
          hint="Based on the latest reconciliation for each provider account."
          icon={Scale}
        />
        <AccountingStat
          label="Provider fees recorded"
          value={String(data.fees.length)}
          hint="Settled and pending fee records in the current ledger view."
          icon={Receipt}
        />
        <AccountingStat
          label="Settlements recorded"
          value={String(data.transfers.length)}
          hint="Completed provider-to-business settlement transfers."
          icon={ArrowRightLeft}
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

      <div className="mt-4 rounded-xl border border-info/20 bg-info/[0.035] p-4">
        <p className="text-xs font-medium">
          How provider balances are calculated
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          Opening balance + completed provider payments − settled provider fees
          − completed transfers out + completed transfers in. Pending fees and
          transfers are shown separately and do not reduce the calculated
          balance. TEST accounts are simulated and must not be treated as real
          funds.
        </p>
      </div>

      <div className="mt-6">
        <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
          Provider accounts
        </p>
      </div>

      {data.accounts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card/40">
          <AdminEmptyState
            icon={Landmark}
            title="No provider accounts yet"
            description="Enable a development gateway and create a provider account before recording fees, settlements, or reconciliations."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {data.accounts.map((account) => (
            <article
              key={account.id}
              className="rounded-2xl border border-border bg-card/40 p-5"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-medium">{account.name}</h2>
                    <Badge
                      variant={
                        account.environment === "LIVE" ? "success" : "warning"
                      }
                    >
                      {account.environment ?? "No environment"}
                    </Badge>
                    <Badge variant={account.isActive ? "outline" : "muted"}>
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {account.providerName ?? "Provider"}
                  </p>
                  <p className="mt-4 text-[10px] text-muted-foreground">
                    Calculated balance
                  </p>
                  <p className="mt-1 text-2xl font-medium tracking-[-0.03em] tabular-nums">
                    {formatIrrDecimal(account.calculatedBalance)}
                  </p>
                  {Number(account.unreceivedInstallments) > 0 ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatIrrDecimal(account.allCashBalance)} if all
                      installments were paid in cash
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFeeTarget(account)}
                  >
                    <Receipt aria-hidden="true" className="size-3.5" />
                    Record fee
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSettlementTarget(account)}
                    disabled={data.businessAccounts.length === 0}
                  >
                    <ArrowRightLeft aria-hidden="true" className="size-3.5" />
                    Settlement
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setReconciliationTarget(account)}
                  >
                    <Scale aria-hidden="true" className="size-3.5" />
                    Reconcile
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-2 rounded-xl border border-border p-4 text-[11px] sm:grid-cols-3">
                <p>
                  Opening{" "}
                  <span className="float-right tabular-nums">
                    {formatIrrDecimal(account.openingBalance)}
                  </span>
                </p>
                <p>
                  Payments received{" "}
                  <span className="float-right tabular-nums">
                    {formatIrrDecimal(account.payments)}
                  </span>
                </p>
                <p>
                  Settled fees{" "}
                  <span className="float-right tabular-nums">
                    {formatIrrDecimal(account.settledFees)}
                  </span>
                </p>
                <p>
                  Transfers out{" "}
                  <span className="float-right tabular-nums">
                    {formatIrrDecimal(account.transfersOut)}
                  </span>
                </p>
                <p>
                  Transfers in{" "}
                  <span className="float-right tabular-nums">
                    {formatIrrDecimal(account.transfersIn)}
                  </span>
                </p>
                <p>
                  Pending fees{" "}
                  <span className="float-right tabular-nums">
                    {formatIrrDecimal(account.pendingFees)}
                  </span>
                </p>
                {Number(account.unreceivedInstallments) > 0 ? (
                  <p>
                    Installments not deposited{" "}
                    <span className="float-right tabular-nums">
                      {formatIrrDecimal(account.unreceivedInstallments)}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex flex-col justify-between gap-2 rounded-xl border border-border bg-white/[0.02] p-4 text-[11px] sm:flex-row sm:items-center">
                <div>
                  <p className="text-muted-foreground">Latest reconciliation</p>
                  {account.lastReconciliation ? (
                    <p className="mt-1">
                      {formatAccountingDate(account.lastReconciliation.asOf)} ·
                      actual{" "}
                      {formatIrrDecimal(
                        account.lastReconciliation.actualBalance
                      )}{" "}
                      · difference{" "}
                      {formatIrrDecimal(account.lastReconciliation.difference)}
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      Not reconciled yet.
                    </p>
                  )}
                </div>
                {account.lastReconciliation ? (
                  <Badge
                    variant={
                      account.lastReconciliation.difference === "0.00"
                        ? "success"
                        : "danger"
                    }
                  >
                    {account.lastReconciliation.difference === "0.00" ? (
                      <>
                        <CheckCircle2 aria-hidden="true" className="size-3" />
                        Matched
                      </>
                    ) : (
                      <>
                        <AlertTriangle aria-hidden="true" className="size-3" />
                        Difference
                      </>
                    )}
                  </Badge>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="border-b border-border p-4">
            <p className="text-xs font-medium">Provider fees</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Pending and settled fees.
            </p>
          </div>
          <DataTable
            rows={data.fees}
            columns={feeColumns}
            getRowId={(fee) => fee.id}
            caption="Provider fees"
            minWidthClassName="min-w-[40rem]"
            emptyState={
              <AdminEmptyState
                icon={Receipt}
                title="No provider fees"
                description="Record gateway fees or commissions to track net provider balances."
                className="py-10"
              />
            }
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="border-b border-border p-4">
            <p className="text-xs font-medium">Settlements</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Provider-to-business transfers.
            </p>
          </div>
          <DataTable
            rows={data.transfers}
            columns={settlementColumns}
            getRowId={(settlement) => settlement.id}
            caption="Provider settlements"
            minWidthClassName="min-w-[40rem]"
            emptyState={
              <AdminEmptyState
                icon={ArrowRightLeft}
                title="No settlements"
                description="Record a settlement when funds move from a provider account to a business account."
                className="py-10"
              />
            }
          />
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="border-b border-border p-4">
          <p className="text-xs font-medium">Reconciliation history</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Provider statement snapshots compared with calculated balances.
          </p>
        </div>
        <DataTable
          rows={data.reconciliations}
          columns={reconciliationColumns}
          getRowId={(reconciliation) => reconciliation.id}
          caption="Provider account reconciliations"
          minWidthClassName="min-w-[42rem]"
          emptyState={
            <AdminEmptyState
              icon={Scale}
              title="No reconciliations"
              description="Reconcile a provider account against its actual statement balance."
              className="py-10"
            />
          }
        />
      </section>

      <RecordFeeDialog
        account={
          editingFee ? accountById(editingFee.providerAccountId) : feeTarget
        }
        fee={editingFee}
        open={Boolean(feeTarget || editingFee)}
        onOpenChange={(open) => {
          if (!open) {
            setFeeTarget(null)
            setEditingFee(null)
          }
        }}
        onCreated={refresh}
      />
      <RecordSettlementDialog
        account={
          editingSettlement
            ? accountById(editingSettlement.fromAccountId)
            : settlementTarget
        }
        businessAccounts={data.businessAccounts}
        settlement={editingSettlement}
        open={Boolean(settlementTarget || editingSettlement)}
        onOpenChange={(open) => {
          if (!open) {
            setSettlementTarget(null)
            setEditingSettlement(null)
          }
        }}
        onCreated={refresh}
      />
      <RecordReconciliationDialog
        account={
          editingReconciliation
            ? accountById(editingReconciliation.accountId)
            : reconciliationTarget
        }
        reconciliation={editingReconciliation}
        open={Boolean(reconciliationTarget || editingReconciliation)}
        onOpenChange={(open) => {
          if (!open) {
            setReconciliationTarget(null)
            setEditingReconciliation(null)
          }
        }}
        onCreated={refresh}
      />
    </>
  )
}

export { ReconciliationWorkspace }

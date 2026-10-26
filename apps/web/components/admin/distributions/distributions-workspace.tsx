"use client"

import {
  BadgeDollarSign,
  Banknote,
  Building2,
  CheckCircle2,
  History,
  Loader2,
  PieChart,
  Plus,
  Trash2,
  TrendingDown,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import {
  ProfitDistributionStatusBadge,
  ProfitPeriodStatusBadge,
} from "@/components/admin/accounting/status-badges"
import { AdminDialog } from "@/components/admin/admin-dialog"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { CalculatePeriodDialog } from "@/components/admin/distributions/calculate-period-dialog"
import { PayoutDialog } from "@/components/admin/distributions/payout-dialog"
import {
  approveProfitPeriodAction,
  deleteProfitPeriodAction,
  updateRetentionPolicyAction,
} from "@/app/admin/distributions/actions"
import type {
  AdminProfitDistribution,
  AdminProfitPeriod,
  DistributionsWorkspace,
} from "@/server/equity/queries"
import {
  formatAccountingDate,
  formatAccountingMonth,
  formatDevelopmentDateTime,
  formatIrrDecimal,
} from "@/lib/admin/format"

function PeriodCard({
  period,
  onOpen,
  onApprove,
  onDelete,
  approving,
  deleting,
}: {
  period: AdminProfitPeriod
  onOpen: () => void
  onApprove: () => void
  onDelete: () => void
  approving: boolean
  deleting: boolean
}) {
  return (
    <article className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium tracking-[-0.02em]">
              {formatAccountingMonth(period.month)}
            </h2>
            <ProfitPeriodStatusBadge status={period.status} />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {formatAccountingDate(period.startsOn)} —{" "}
            {formatAccountingDate(period.endsOn)} · {period.ownershipTotal}%
            ownership snapshot
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpen}>
            View allocations
          </Button>
          {period.status === "DRAFT" ? (
            <Button
              type="button"
              size="sm"
              onClick={onApprove}
              disabled={approving}
            >
              {approving ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
              )}
              Approve period
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${formatAccountingMonth(period.month)} period`}
            onClick={onDelete}
            disabled={deleting}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {deleting ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-white/[0.02] p-3">
          <p className="text-[9px] text-muted-foreground">Revenue</p>
          <p className="mt-1 text-xs font-medium tabular-nums">
            {formatIrrDecimal(period.totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white/[0.02] p-3">
          <p className="text-[9px] text-muted-foreground">Net profit</p>
          <p className="mt-1 text-xs font-medium tabular-nums">
            {formatIrrDecimal(period.netProfit)}
          </p>
        </div>
        <div className="rounded-xl border border-info/25 bg-info/[0.04] p-3">
          <p className="text-[9px] text-muted-foreground">
            Retained in company ({Number(period.retentionPercentage)}%)
          </p>
          <p className="mt-1 text-xs font-medium tabular-nums">
            {formatIrrDecimal(period.retainedEarnings)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white/[0.02] p-3">
          <p className="text-[9px] text-muted-foreground">
            Shareholder pool (
            {Number((100 - Number(period.retentionPercentage)).toFixed(4))}%)
          </p>
          <p className="mt-1 text-xs font-medium tabular-nums">
            {formatIrrDecimal(period.distributableAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white/[0.02] p-3">
          <p className="text-[9px] text-muted-foreground">Paid out</p>
          <p className="mt-1 text-xs font-medium tabular-nums">
            {formatIrrDecimal(period.totalPaid)}
          </p>
        </div>
      </div>
    </article>
  )
}

function PeriodDetailDialog({
  period,
  accounts,
  onClose,
  onApprove,
  onPayout,
  approving,
}: {
  period: AdminProfitPeriod
  accounts: Array<{ id: string; name: string }>
  onClose: () => void
  onApprove: () => void
  onPayout: (distribution: AdminProfitDistribution) => void
  approving: boolean
}) {
  return (
    <AdminDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={`${formatAccountingMonth(period.month)} allocations`}
      description={`${formatAccountingDate(period.startsOn)} — ${formatAccountingDate(period.endsOn)}`}
      className="max-w-4xl"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ProfitPeriodStatusBadge status={period.status} />
        <Badge variant="outline">
          {Number(period.retentionPercentage)}% company retained
        </Badge>
        <Badge variant="outline">
          {Number((100 - Number(period.retentionPercentage)).toFixed(4))}%
          shareholder pool
        </Badge>
        <Badge variant="outline">{period.ownershipTotal}% ownership</Badge>
      </div>

      <div className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-info/25 bg-info/[0.04] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">
                Company Retained Earnings ({Number(period.retentionPercentage)}
                %)
              </p>
              <Badge variant="outline">Company record</Badge>
            </div>
            <p className="mt-2 text-lg font-medium tabular-nums">
              {formatIrrDecimal(period.retainedEarnings)}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Remains in the company for future growth and expenses. Does not
              belong to a separate shareholder.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">
                Shareholder Distributable Pool (
                {Number((100 - Number(period.retentionPercentage)).toFixed(4))}
                %)
              </p>
              <Badge variant="outline">
                {period.ownershipTotal}% ownership
              </Badge>
            </div>
            <p className="mt-2 text-lg font-medium tabular-nums">
              {formatIrrDecimal(period.distributableAmount)}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Distributed among shareholders according to their unchanged
              ownership percentages.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-xl border border-border p-4 text-xs sm:grid-cols-3">
          <p>
            Revenue{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.totalRevenue)}
            </span>
          </p>
          <p>
            Paid expenses{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.totalExpenses)}
            </span>
          </p>
          <p>
            Provider fees{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.providerFees)}
            </span>
          </p>
          <p>
            Tax{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.taxAmount)}
            </span>
          </p>
          <p>
            Net profit{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.netProfit)}
            </span>
          </p>
          <p>
            Retained ({Number(period.retentionPercentage)}%){" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.retainedEarnings)}
            </span>
          </p>
          <p>
            Prior loss{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.lossBalanceBefore)}
            </span>
          </p>
          <p>
            Loss applied{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.lossApplied)}
            </span>
          </p>
          <p>
            Distributable ({Number((100 - Number(period.retentionPercentage)).toFixed(4))}%){" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.distributableAmount)}
            </span>
          </p>
          <p>
            Ownership total{" "}
            <span className="float-right tabular-nums">
              {period.ownershipTotal}%
            </span>
          </p>
          <p>
            Retained residual{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.unallocatedResidual)}
            </span>
          </p>
          <p>
            Paid to date{" "}
            <span className="float-right tabular-nums">
              {formatIrrDecimal(period.totalPaid)}
            </span>
          </p>
        </div>

        {period.adjustmentNote ? (
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Adjustment note: {period.adjustmentNote}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs font-medium">Shareholder allocations</p>
          <Badge variant="outline">
            {period.distributions.length} allocations
          </Badge>
        </div>

        {period.distributions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-[11px] text-muted-foreground">
            No positive distribution exists for this period. A loss or zero
            profit is recorded without payouts.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {period.distributions.map((distribution) => (
              <div
                key={distribution.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium">
                      {distribution.shareholderName}
                    </p>
                    <Badge variant="outline">{distribution.percentage}%</Badge>
                    <ProfitDistributionStatusBadge
                      status={distribution.status}
                    />
                  </div>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {formatIrrDecimal(distribution.amount)}
                  </p>
                  {distribution.payout ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {distribution.payout.accountName ?? "No account"} ·{" "}
                      {distribution.payout.paidAt
                        ? formatDevelopmentDateTime(distribution.payout.paidAt)
                        : "Not paid"}
                      {distribution.payout.externalReference
                        ? ` · ${distribution.payout.externalReference}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                {period.status === "APPROVED" &&
                distribution.status === "PENDING" &&
                !distribution.payout &&
                distribution.amount !== "0.00" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPayout(distribution)}
                    disabled={accounts.length === 0}
                  >
                    <Banknote aria-hidden="true" className="size-3.5" />
                    Record payout
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {period.status === "DRAFT" ? (
          <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-warning/20 bg-warning/[0.035] p-4 sm:flex-row sm:items-center">
            <p className="text-[11px] leading-5 text-muted-foreground">
              Approval locks the monthly calculation and approves every
              shareholder allocation. Payouts become available afterward.
            </p>
            <Button
              type="button"
              onClick={onApprove}
              disabled={approving}
              className="shrink-0"
            >
              {approving ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
              )}
              Approve period
            </Button>
          </div>
        ) : null}

        {period.status === "APPROVED" ? (
          <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
            Record one full payout per shareholder. The period closes
            automatically after all positive allocations are paid.
          </p>
        ) : null}
      </div>
    </AdminDialog>
  )
}

function DistributionsWorkspace({
  data,
  currentOwnershipTotal,
  shareholderCount,
}: {
  data: DistributionsWorkspace
  currentOwnershipTotal: string
  shareholderCount: number
}) {
  const router = useRouter()
  const [calculateOpen, setCalculateOpen] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [payoutTarget, setPayoutTarget] =
    useState<AdminProfitDistribution | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retentionInput, setRetentionInput] = useState(
    data.defaultRetentionPercentage
  )
  const [retentionSavedMessage, setRetentionSavedMessage] = useState<
    string | null
  >(null)

  useEffect(() => {
    setRetentionInput(data.defaultRetentionPercentage)
  }, [data.defaultRetentionPercentage])

  const parsedRetention = Number.parseFloat(retentionInput || "0")
  const previewRetention =
    Number.isFinite(parsedRetention) &&
    parsedRetention >= 0 &&
    parsedRetention <= 100
      ? parsedRetention
      : 0
  const previewShareholderShare = Number(
    (100 - previewRetention).toFixed(4)
  )

  const selectedPeriod =
    data.periods.find((period) => period.id === selectedPeriodId) ?? null
  const ownershipReady =
    shareholderCount > 0 && currentOwnershipTotal === "100.0000"

  const refresh = () => router.refresh()

  const saveRetentionPolicy = async () => {
    setPendingKey("retention-policy")
    setError(null)
    setRetentionSavedMessage(null)

    const result = await updateRetentionPolicyAction({
      retentionPercentage: retentionInput,
    })

    if (!result.ok) {
      setError(result.error ?? "The retention percentage could not be updated.")
    } else {
      setRetentionSavedMessage(
        `Default company retention updated to ${previewRetention}% (${previewShareholderShare}% distributed to shareholders).`
      )
      refresh()
    }

    setPendingKey(null)
  }

  const approve = async (period: AdminProfitPeriod) => {
    if (
      !window.confirm(
        `Approve the ${formatAccountingMonth(period.month)} distribution? This locks the calculation and approves all allocations.`
      )
    ) {
      return
    }

    setPendingKey(period.id)
    setError(null)

    const result = await approveProfitPeriodAction({
      profitPeriodId: period.id,
    })

    if (!result.ok) {
      setError(result.error ?? "The period could not be approved.")
    } else {
      refresh()
    }

    setPendingKey(null)
  }

  const removePeriod = async (period: AdminProfitPeriod) => {
    if (
      !window.confirm(
        `Remove the ${formatAccountingMonth(period.month)} profit period? Any allocations and payout records for this period will also be removed.`
      )
    ) {
      return
    }

    setPendingKey(`delete:${period.id}`)
    setError(null)

    const result = await deleteProfitPeriodAction({
      profitPeriodId: period.id,
    })

    if (!result.ok) {
      setError(result.error ?? "The profit period could not be removed.")
    } else {
      if (selectedPeriodId === period.id) {
        setSelectedPeriodId(null)
      }
      refresh()
    }

    setPendingKey(null)
  }

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingStat
          label="Company retained earnings"
          value={formatIrrDecimal(data.summary.totalRetainedEarnings)}
          hint="Net profit kept in the company for future growth & expenses."
          icon={Building2}
        />
        <AccountingStat
          label="Shareholder distributable"
          value={formatIrrDecimal(data.summary.totalDistributable)}
          hint="Remaining net profit allocated to shareholders."
          icon={PieChart}
        />
        <AccountingStat
          label="Total paid out"
          value={formatIrrDecimal(data.summary.totalPaid)}
          hint="Completed full shareholder payouts."
          icon={BadgeDollarSign}
        />
        <AccountingStat
          label="Loss carried forward"
          value={formatIrrDecimal(data.summary.lossCarryforward)}
          hint="Accumulated losses to offset future profit."
          icon={TrendingDown}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Building2 aria-hidden="true" className="size-4 text-info" />
              <h2 className="text-sm font-medium">
                Configurable Company Retention Policy
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Configure the percentage of monthly net profit that remains in the
              company as retained earnings for future growth and expenses. Only
              the remaining{" "}
              <span className="font-medium text-foreground">
                {previewShareholderShare}%
              </span>{" "}
              is distributed among shareholders according to their unchanged
              ownership percentages.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44 space-y-1.5">
              <Label htmlFor="retention-percentage-input" className="text-xs">
                Company retention (%)
              </Label>
              <Input
                id="retention-percentage-input"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={retentionInput}
                onChange={(event) => {
                  setRetentionInput(event.target.value)
                  setRetentionSavedMessage(null)
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={saveRetentionPolicy}
              disabled={pendingKey === "retention-policy"}
            >
              {pendingKey === "retention-policy" ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                  Saving…
                </>
              ) : (
                "Save retention %"
              )}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-white/[0.02] p-3.5 text-[11px] text-muted-foreground sm:grid-cols-3">
          <div>
            <span className="font-medium text-foreground">
              Company retained ({previewRetention}%):
            </span>{" "}
            Kept in the company ledger (not assigned to a separate shareholder).
          </div>
          <div>
            <span className="font-medium text-foreground">
              Shareholder pool ({previewShareholderShare}%):
            </span>{" "}
            Allocated across shareholders using their existing{" "}
            {currentOwnershipTotal}% ownership.
          </div>
          <div>
            <span className="font-medium text-foreground">
              Example on 10,000,000:
            </span>{" "}
            {Math.round(10_000_000 * (previewRetention / 100)).toLocaleString(
              "en-US"
            )}{" "}
            retained ·{" "}
            {Math.round(
              10_000_000 * (previewShareholderShare / 100)
            ).toLocaleString("en-US")}{" "}
            distributed (60% owner →{" "}
            {Math.round(
              10_000_000 * (previewShareholderShare / 100) * 0.6
            ).toLocaleString("en-US")}
            , 40% owner →{" "}
            {Math.round(
              10_000_000 * (previewShareholderShare / 100) * 0.4
            ).toLocaleString("en-US")}
            ).
          </div>
        </div>

        {retentionSavedMessage ? (
          <p className="mt-3 text-xs text-success">{retentionSavedMessage}</p>
        ) : null}
      </section>

      {!ownershipReady ? (
        <div className="mt-4 rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
          <p className="text-xs font-medium">
            Ownership is not ready for a positive distribution
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {shareholderCount === 0
              ? "No shareholders exist yet."
              : `Current ownership totals ${currentOwnershipTotal}%.`}{" "}
            A positive profit period requires exactly 100.0000% ownership at the
            period end date.{" "}
            <Link
              href="/admin/shareholders"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Manage shareholders
            </Link>
            .
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-info/20 bg-info/[0.035] p-4">
        <div className="flex items-start gap-3">
          <History
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-info"
          />
          <div>
            <p className="text-xs font-medium">Approved distribution rules</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Monthly calendar periods in Asia/Tehran · gross completed LIVE
              payments plus manual income · minus paid expenses, settled LIVE
              provider fees, reserve, and tax · period-end ownership at exactly
              100% · whole-IRR allocations with residual retained · losses
              carried forward · single-manager approval · one full payout per
              shareholder. TEST payments are excluded.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Profit history
          </p>
          <p className="mt-2 text-sm font-medium">
            {data.periods.length}{" "}
            {data.periods.length === 1 ? "period" : "periods"}
          </p>
        </div>
        <Button type="button" onClick={() => setCalculateOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Calculate month
        </Button>
      </div>

      {data.periods.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card/40">
          <AdminEmptyState
            icon={PieChart}
            title="No profit periods yet"
            description="Calculate a month after shareholder ownership and accounting records are ready. The period remains a draft until a manager approves it."
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => setCalculateOpen(true)}
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Calculate first month
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {data.periods.map((period) => (
            <PeriodCard
              key={period.id}
              period={period}
              onOpen={() => setSelectedPeriodId(period.id)}
              onApprove={() => approve(period)}
              onDelete={() => removePeriod(period)}
              approving={pendingKey === period.id}
              deleting={pendingKey === `delete:${period.id}`}
            />
          ))}
        </div>
      )}

      <CalculatePeriodDialog
        currentMonth={data.currentMonth}
        defaultRetentionPercentage={data.defaultRetentionPercentage}
        open={calculateOpen}
        onOpenChange={setCalculateOpen}
        onCalculated={(id) => {
          setSelectedPeriodId(id)
          refresh()
        }}
      />

      {selectedPeriod ? (
        <PeriodDetailDialog
          period={selectedPeriod}
          accounts={data.accounts}
          onClose={() => setSelectedPeriodId(null)}
          onApprove={() => approve(selectedPeriod)}
          onPayout={setPayoutTarget}
          approving={pendingKey === selectedPeriod.id}
        />
      ) : null}

      <PayoutDialog
        distribution={payoutTarget}
        accounts={data.accounts}
        onOpenChange={(open) => {
          if (!open) {
            setPayoutTarget(null)
          }
        }}
        onPaid={() => {
          setPayoutTarget(null)
          refresh()
        }}
      />
    </>
  )
}

export { DistributionsWorkspace }

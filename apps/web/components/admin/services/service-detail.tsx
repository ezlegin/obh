"use client"

import {
  ArrowLeft,
  Calculator,
  CreditCard,
  Loader2,
  Pencil,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { AdminDialog } from "@/components/admin/admin-dialog"
import {
  calculateServiceProfitAction,
  deleteServiceProfitPeriodAction,
  setServiceOwnershipAction,
} from "@/app/admin/services/service-profit-actions"
import type {
  ServiceWorkspace,
  ServiceWorkspacePeriod,
} from "@/server/services/service-queries"
import {
  formatAccountingDate,
  formatDevelopmentDateTime,
  formatIrrDecimal,
} from "@/lib/admin/format"

type ServiceDetailProps = {
  data: ServiceWorkspace
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: typeof CreditCard
  tone?: "success" | "danger" | "default"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[9px] tracking-[0.13em] text-muted-foreground/60 uppercase">
          {label}
        </p>
        <Icon
          aria-hidden="true"
          className={
            tone === "success"
              ? "size-3.5 text-success"
              : tone === "danger"
                ? "size-3.5 text-danger"
                : "size-3.5 text-muted-foreground/50"
          }
        />
      </div>
      <p className="mt-3 text-lg font-medium tabular-nums">
        {formatIrrDecimal(value)}
      </p>
    </div>
  )
}

function OwnershipDialog({
  data,
  open,
  onOpenChange,
  onSaved,
}: {
  data: ServiceWorkspace
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      return
    }

    const initial: Record<string, string> = {}
    for (const shareholder of data.shareholders) {
      const existing = data.ownership.entries.find(
        (entry) => entry.shareholderId === shareholder.id
      )
      initial[shareholder.id] =
        data.ownership.source === "SERVICE"
          ? (existing?.percentage.replace(/\.?0+$/, "") ?? "0")
          : "0"
    }
    setValues(initial)
    setError(null)
  }, [open, data.ownership, data.shareholders])

  const total = Object.values(values).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  )

  const save = () => {
    setError(null)

    if (total > 0 && Math.abs(total - 100) > 0.0001) {
      setError(
        `Ownership must total exactly 100%. Current total: ${total.toFixed(4)}%.`
      )
      return
    }

    startTransition(async () => {
      const result = await setServiceOwnershipAction({
        serviceId: data.service.id,
        shares: data.shareholders.map((shareholder) => ({
          shareholderId: shareholder.id,
          percentage: values[shareholder.id]?.trim() || "0",
        })),
      })

      if (!result.ok) {
        setError(result.error ?? "Ownership could not be saved.")
        return
      }

      onOpenChange(false)
      onSaved()
    })
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Ownership · ${data.service.name}`}
      description="Set service-specific percentages. Leave every shareholder at 0% to fall back to corporation ownership."
      className="max-w-xl"
    >
      <div className="space-y-3">
        {data.shareholders.length === 0 ? (
          <p className="rounded-xl border border-warning/20 bg-warning/[0.045] p-3 text-xs text-muted-foreground">
            Add shareholders first on the Shareholders page.
          </p>
        ) : (
          data.shareholders.map((shareholder) => (
            <div
              key={shareholder.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border p-3"
            >
              <div>
                <p className="text-xs font-medium">{shareholder.name}</p>
                {!shareholder.isActive ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Inactive shareholder
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={values[shareholder.id] ?? "0"}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [shareholder.id]: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  aria-label={`${shareholder.name} percentage`}
                  className="w-24 text-right"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))
        )}

        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Total</span>
          <span
            className={
              total > 0 && Math.abs(total - 100) > 0.0001
                ? "font-medium text-danger tabular-nums"
                : "font-medium tabular-nums"
            }
          >
            {total.toFixed(4)}%
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-xs leading-5 text-danger"
          >
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={isPending}>
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Save ownership
          </Button>
        </div>
      </div>
    </AdminDialog>
  )
}

function PeriodCard({
  period,
  onDeleted,
}: {
  period: ServiceWorkspacePeriod
  onDeleted: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const remove = () => {
    if (
      !window.confirm(
        `Delete the distribution for ${formatAccountingDate(period.startsOn)} – ${formatAccountingDate(period.endsOn)}?`
      )
    ) {
      return
    }

    startTransition(async () => {
      const result = await deleteServiceProfitPeriodAction({
        serviceProfitPeriodId: period.id,
      })

      if (!result.ok) {
        setError(result.error ?? "The period could not be deleted.")
      } else {
        onDeleted()
      }
    })
  }

  return (
    <article className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {formatAccountingDate(period.startsOn)} –{" "}
            {formatAccountingDate(period.endsOn)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Calculated {formatDevelopmentDateTime(period.calculatedAt)} ·{" "}
            {period.ownershipSource === "SERVICE"
              ? "service ownership"
              : "corporation ownership"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              period.distributableAmount === "0.00" ? "muted" : "success"
            }
          >
            {formatIrrDecimal(period.distributableAmount)}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Delete service distribution"
            onClick={remove}
            disabled={isPending}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-[11px] sm:grid-cols-2">
        <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
          <dt className="text-muted-foreground">Gateway revenue</dt>
          <dd className="tabular-nums">
            {formatIrrDecimal(period.grossPayments)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
          <dt className="text-muted-foreground">Assigned income</dt>
          <dd className="tabular-nums">
            {formatIrrDecimal(period.manualIncome)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
          <dt className="text-muted-foreground">Assigned expenses</dt>
          <dd className="tabular-nums">
            {formatIrrDecimal(period.totalExpenses)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
          <dt className="text-muted-foreground">Provider fees</dt>
          <dd className="tabular-nums">
            {formatIrrDecimal(period.providerFees)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 pb-1.5">
          <dt className="text-muted-foreground">Net profit</dt>
          <dd className="tabular-nums">{formatIrrDecimal(period.netProfit)}</dd>
        </div>
        <div className="flex justify-between gap-3 pb-1.5">
          <dt className="text-muted-foreground">Ownership total</dt>
          <dd className="tabular-nums">{period.ownershipTotal}%</dd>
        </div>
      </dl>

      {period.distributions.length > 0 ? (
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {period.distributions.map((distribution) => (
            <div
              key={distribution.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
            >
              <span>{distribution.shareholderName}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                <span className="tabular-nums">{distribution.percentage}%</span>
                <span className="font-medium text-foreground tabular-nums">
                  {formatIrrDecimal(distribution.allocatedAmount)}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-center text-[11px] text-muted-foreground">
          No distributable profit for this period.
        </p>
      )}

      {error ? <p className="mt-3 text-[11px] text-danger">{error}</p> : null}
    </article>
  )
}

function ServiceDetail({ data }: ServiceDetailProps) {
  const router = useRouter()
  const [ownershipOpen, setOwnershipOpen] = useState(false)
  const [month, setMonth] = useState(data.currentMonth)
  const [calculating, startCalculation] = useTransition()
  const [calculationError, setCalculationError] = useState<string | null>(null)

  const calculate = () => {
    setCalculationError(null)

    startCalculation(async () => {
      const result = await calculateServiceProfitAction({
        serviceId: data.service.id,
        month,
      })

      if (!result.ok) {
        setCalculationError(
          result.error ?? "The service distribution could not be calculated."
        )
      } else {
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/services"
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-3" />
            All services
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.045em]">
              {data.service.name}
            </h1>
            <Badge variant={data.service.isActive ? "success" : "muted"}>
              {data.service.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            {data.service.domain} · /{data.service.slug}
          </p>
          {data.service.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {data.service.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Gateway revenue"
          value={data.stats.grossPayments}
          icon={CreditCard}
        />
        <StatCard
          label="Assigned income"
          value={data.stats.income}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Assigned expenses"
          value={data.stats.expenses}
          icon={TrendingDown}
          tone="danger"
        />
        <StatCard
          label="Provider fees"
          value={data.stats.providerFees}
          icon={Receipt}
        />
        <StatCard
          label="Service balance"
          value={data.stats.balance}
          icon={Wallet}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <section className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Ownership</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {data.ownership.source === "SERVICE"
                  ? "Service-specific percentages override corporation ownership."
                  : "Using corporation ownership because no service percentages are set."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setOwnershipOpen(true)}
            >
              <Pencil aria-hidden="true" className="size-3" />
              Edit
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {data.ownership.entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-[11px] text-muted-foreground">
                No ownership configured.
              </p>
            ) : (
              data.ownership.entries.map((entry) => (
                <div
                  key={entry.shareholderId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5"
                >
                  <span className="text-xs">{entry.shareholderName}</span>
                  <span className="text-xs font-medium tabular-nums">
                    {entry.percentage}%
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-medium">
            Calculate a monthly distribution
          </h2>
          <p className="mt-1 max-w-xl text-[10px] leading-4 text-muted-foreground">
            Revenue = completed LIVE gateway payments + income assigned to this
            service. Costs = assigned paid expenses + settled provider fees for
            this service. The result is split by the ownership shown on the
            left, snapshotted per period.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="service-profit-month">Month</Label>
              <Input
                id="service-profit-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-44"
              />
            </div>
            <Button
              type="button"
              onClick={calculate}
              disabled={calculating || !month}
            >
              {calculating ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Calculator aria-hidden="true" className="size-4" />
              )}
              Calculate distribution
            </Button>
          </div>
          {calculationError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-xs leading-5 text-danger"
            >
              {calculationError}
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium tracking-[-0.02em]">
              Service distributions
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {data.periods.length} calculated period
              {data.periods.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {data.periods.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border px-5 py-10 text-center text-xs text-muted-foreground">
            No service distributions calculated yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {data.periods.map((period) => (
              <PeriodCard
                key={period.id}
                period={period}
                onDeleted={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card/40">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-sm font-medium">Recent payments</h2>
            <Badge variant="outline">{data.stats.paymentCount} total</Badge>
          </div>
          <div className="divide-y divide-border">
            {data.payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-[11px] text-muted-foreground">
                No payments recorded for this service.
              </p>
            ) : (
              data.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <div>
                    <p className="font-mono text-[10px]">{payment.reference}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {payment.environment} · {payment.status}
                    </p>
                  </div>
                  <span className="tabular-nums">
                    {formatIrrDecimal(payment.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/40">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-sm font-medium">Assigned income</h2>
            <Badge variant="outline">{data.stats.incomeCount} records</Badge>
          </div>
          <div className="divide-y divide-border">
            {data.incomes.length === 0 ? (
              <p className="px-5 py-8 text-center text-[11px] text-muted-foreground">
                No income assigned to this service.
              </p>
            ) : (
              data.incomes.map((income) => (
                <div
                  key={income.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate">{income.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatAccountingDate(income.receivedOn)}
                      {income.source ? ` · ${income.source}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-success tabular-nums">
                    {formatIrrDecimal(income.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/40 xl:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-sm font-medium">Assigned expenses</h2>
            <Badge variant="outline">{data.stats.expenseCount} records</Badge>
          </div>
          <div className="divide-y divide-border">
            {data.expenses.length === 0 ? (
              <p className="px-5 py-8 text-center text-[11px] text-muted-foreground">
                No expenses assigned to this service.
              </p>
            ) : (
              data.expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate">{expense.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {expense.categoryName} ·{" "}
                      {formatAccountingDate(expense.spentOn)} · {expense.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-danger tabular-nums">
                    {formatIrrDecimal(expense.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <OwnershipDialog
        data={data}
        open={ownershipOpen}
        onOpenChange={setOwnershipOpen}
        onSaved={() => router.refresh()}
      />
    </>
  )
}

export { ServiceDetail }

import {
  CalendarClock,
  CircleDollarSign,
  HandCoins,
  Hourglass,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import { formatIrrDecimal } from "@/lib/admin/format"
import type {
  InstallmentPlanView,
  InstallmentsWorkspace as InstallmentsWorkspaceData,
} from "@/server/payments/installments/queries"

function progressPercent(plan: InstallmentPlanView) {
  const total = Number(plan.totalAmount)
  return total > 0
    ? Math.min(100, Math.round((Number(plan.receivedAmount) / total) * 100))
    : 0
}

function PlanStatusBadge({ plan }: { plan: InstallmentPlanView }) {
  if (plan.status === "CANCELLED") {
    return <Badge variant="danger">Cancelled</Badge>
  }

  return Number(plan.outstandingAmount) > 0 ? (
    <Badge variant="warning">
      {plan.receivedCount}/{plan.installmentCount} received
    </Badge>
  ) : (
    <Badge variant="success">Fully received</Badge>
  )
}

function InstallmentsWorkspace({ data }: { data: InstallmentsWorkspaceData }) {
  const testHasData = Number(data.test.claimed) > 0

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingStat
          label="Total claimed"
          value={formatIrrDecimal(data.live.claimed)}
          hint="Full value of verified LIVE installment purchases."
          icon={HandCoins}
        />
        <AccountingStat
          label="Received"
          value={formatIrrDecimal(data.live.received)}
          hint="Checkout installments plus monthly deposits already made. Included in the business balance."
          icon={CircleDollarSign}
        />
        <AccountingStat
          label="Not paid to us yet"
          value={formatIrrDecimal(data.live.outstanding)}
          hint={`${data.live.activePlans} purchase${data.live.activePlans === 1 ? "" : "s"} still being repaid. Excluded from the business balance until deposited.`}
          icon={Hourglass}
        />
        <AccountingStat
          label="Next deposit"
          value={
            data.nextDeposit ? formatIrrDecimal(data.nextDeposit.amount) : "—"
          }
          hint={
            data.nextDeposit
              ? `Expected on ${data.nextDeposit.dueOnPersian} (${data.nextDeposit.dueOn}).`
              : "No LIVE installments are scheduled."
          }
          icon={CalendarClock}
        />
      </div>

      {testHasData ? (
        <p className="mt-3 rounded-xl border border-border px-4 py-3 text-[11px] leading-5 text-muted-foreground">
          TEST (simulator) installments are tracked separately: claimed{" "}
          {formatIrrDecimal(data.test.claimed)}, received{" "}
          {formatIrrDecimal(data.test.received)}, outstanding{" "}
          {formatIrrDecimal(data.test.outstanding)}.
        </p>
      ) : null}

      <section
        aria-labelledby="forecast-heading"
        className="mt-6 rounded-2xl border border-border bg-card/40 p-5"
      >
        <h2
          id="forecast-heading"
          className="text-sm font-medium tracking-[-0.01em]"
        >
          Upcoming deposits (LIVE)
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Amounts the gateway deposits on the 7th of each Iranian month.
        </p>
        {data.forecast.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Nothing is scheduled.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {data.forecast.map((month) => (
              <li
                key={month.dueOn}
                className="flex items-center justify-between gap-4 py-2.5 text-xs"
              >
                <span>
                  {month.monthLabel}
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {month.dueOn}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">
                    {month.count} installment{month.count === 1 ? "" : "s"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatIrrDecimal(month.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="plans-heading" className="mt-6">
        <h2 id="plans-heading" className="text-sm font-medium">
          Installment purchases
        </h2>

        {data.plans.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-border bg-card/40 p-6 text-xs text-muted-foreground">
            No installment purchases yet. They appear here once a Digipay BNPL
            or credit payment is verified.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.plans.map((plan) => (
              <details
                key={plan.id}
                className="group rounded-2xl border border-border bg-card/40"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">
                        {plan.paymentReference}
                      </span>
                      <PlanStatusBadge plan={plan} />
                      <Badge variant="outline">
                        {plan.environment === "LIVE" ? "Live" : "Simulator"}
                      </Badge>
                      {plan.purchaseType ? (
                        <Badge variant="outline">{plan.purchaseType}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                      {plan.serviceName ?? "Unassigned service"}
                      {plan.externalOrderId
                        ? ` · Order ${plan.externalOrderId}`
                        : ""}{" "}
                      · Purchased {plan.purchasedOnPersian}
                    </p>
                  </div>

                  <div className="w-full shrink-0 sm:w-64">
                    <div className="flex justify-between text-[11px] tabular-nums">
                      <span>{formatIrrDecimal(plan.receivedAmount)}</span>
                      <span className="text-muted-foreground">
                        of {formatIrrDecimal(plan.totalAmount)}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                      role="progressbar"
                      aria-label={`Received ${progressPercent(plan)}%`}
                      aria-valuenow={progressPercent(plan)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${progressPercent(plan)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {plan.nextDueOnPersian && plan.nextAmount
                        ? `Next: ${formatIrrDecimal(plan.nextAmount)} on ${plan.nextDueOnPersian}`
                        : "Nothing left to collect"}
                    </p>
                  </div>
                </summary>

                <div className="border-t border-border px-5 py-4">
                  <table className="w-full text-xs">
                    <caption className="sr-only">
                      Installments for {plan.paymentReference}
                    </caption>
                    <thead>
                      <tr className="text-left text-[10px] text-muted-foreground">
                        <th className="pb-2 font-normal">#</th>
                        <th className="pb-2 font-normal">Due</th>
                        <th className="pb-2 font-normal">Amount</th>
                        <th className="pb-2 text-right font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.installments.map((installment) => (
                        <tr
                          key={installment.id}
                          className="border-t border-border"
                        >
                          <td className="py-2">{installment.sequence}</td>
                          <td className="py-2">
                            {installment.sequence === 1
                              ? `At checkout · ${installment.dueOnPersian}`
                              : installment.dueOnPersian}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                              {installment.dueOn}
                            </span>
                          </td>
                          <td className="py-2 tabular-nums">
                            {formatIrrDecimal(installment.amount)}
                          </td>
                          <td
                            className={cn(
                              "py-2 text-right",
                              installment.received
                                ? "text-success"
                                : installment.status === "CANCELLED"
                                  ? "text-danger"
                                  : "text-muted-foreground"
                            )}
                          >
                            {installment.received
                              ? "Received"
                              : installment.status === "CANCELLED"
                                ? "Cancelled"
                                : "Scheduled"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export { InstallmentsWorkspace }

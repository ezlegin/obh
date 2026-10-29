import type { Metadata } from "next"
import Link from "next/link"
import { PiggyBank, Receipt, TrendingUp, Wallet } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { AccountBalances } from "@/components/admin/account-balances"
import { AdminPageHeader } from "@/components/admin/admin-page"
import { CashflowChart } from "@/components/admin/cashflow-chart"
import { DashboardAlerts } from "@/components/admin/dashboard-alerts"
import { DashboardTransactions } from "@/components/admin/dashboard-transactions"
import { SummaryCard } from "@/components/admin/summary-card"
import { formatIrr } from "@/lib/admin/format"
import {
  DASHBOARD_PERIOD_OPTIONS,
  getDashboardDataForAdmin,
  parseDashboardPeriod,
} from "@/server/dashboard/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: {
    absolute: "Dashboard — OBH Admin",
  },
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string | string[]
    balance?: string | string[]
  }>
}) {
  const params = await searchParams
  const selectedPeriod = parseDashboardPeriod(params.period)
  const allCash = params.balance === "all-cash"
  const dashboard = await getDashboardDataForAdmin(selectedPeriod)
  const receivable = dashboard.summary.installmentReceivable

  const summaryCards = [
    {
      id: "balance",
      label: allCash
        ? "Business balance (all paid in cash)"
        : "Total business balance",
      value: allCash
        ? dashboard.summary.allCashBalance
        : dashboard.summary.totalBalance,
      hint:
        receivable > 0
          ? allCash
            ? `Includes ${formatIrr(receivable)} of installments not deposited yet`
            : `Excludes ${formatIrr(receivable)} of installments not deposited yet`
          : `Across ${dashboard.summary.accountCount} active account${dashboard.summary.accountCount === 1 ? "" : "s"}`,
      icon: Wallet,
      change: `${dashboard.summary.accountCount} active`,
      badge:
        receivable > 0
          ? {
              label: `${formatIrr(receivable)} owed`,
              title:
                "Installments we have claimed that the gateway has not deposited yet. Opens the Installments page.",
              href: "/admin/installments",
            }
          : undefined,
      changeTone: "neutral" as const,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: dashboard.summary.revenue,
      hint: dashboard.summary.comparisonHint,
      icon: TrendingUp,
      change: dashboard.summary.revenueChangeLabel,
      changeTone: dashboard.summary.revenueChangeTone,
    },
    {
      id: "expenses",
      label: "Expenses",
      value: dashboard.summary.expenses,
      hint: dashboard.summary.comparisonHint,
      icon: Receipt,
      change: dashboard.summary.expensesChangeLabel,
      changeTone: dashboard.summary.expensesChangeTone,
    },
    {
      id: "profit",
      label: "Net profit",
      value: dashboard.summary.netProfit,
      hint: dashboard.summary.comparisonHint,
      icon: PiggyBank,
      change: dashboard.summary.profitChangeLabel,
      changeTone: dashboard.summary.profitChangeTone,
    },
  ]

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Overview"
        title="Financial overview"
        description="Live summary of OBH gateway balances, verified payment revenue, operating expenses, and recent transactions."
      />

      <section aria-labelledby="summary-heading" className="mt-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Summary
            </p>
            <h2
              id="summary-heading"
              className="mt-2 text-xl font-medium tracking-[-0.025em]"
            >
              {dashboard.summary.periodLabel}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div
              role="group"
              aria-label="Business balance basis"
              className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-white/[0.02] p-0.5"
            >
              {[
                { id: "received", label: "Received cash" },
                { id: "all-cash", label: "Assume all paid" },
              ].map((option) => {
                const active = allCash === (option.id === "all-cash")
                return (
                  <Link
                    key={option.id}
                    href={`/admin?period=${dashboard.period}${option.id === "all-cash" ? "&balance=all-cash" : ""}`}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    title={
                      option.id === "all-cash"
                        ? "Show the balance as if every installment purchase had been paid in full"
                        : "Show only money actually received"
                    }
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </Link>
                )
              })}
            </div>

            <div
              role="group"
              aria-label="Filter dashboard period"
              className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-white/[0.02] p-0.5"
            >
              {DASHBOARD_PERIOD_OPTIONS.map((option) => {
                const active = dashboard.period === option.id
                return (
                  <Link
                    key={option.id}
                    href={`/admin?period=${option.id}${allCash ? "&balance=all-cash" : ""}`}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.id}
              label={card.label}
              value={formatIrr(card.value)}
              hint={card.hint}
              icon={card.icon}
              change={card.change}
              changeTone={card.changeTone}
              badge={"badge" in card ? card.badge : undefined}
            />
          ))}
        </div>
      </section>

      <div className="mt-4">
        <CashflowChart
          data={dashboard.cashflow}
          rangeLabel={dashboard.cashflowRangeLabel}
          badgeLabel={dashboard.cashflowBadgeLabel}
        />
      </div>

      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <AccountBalances accounts={dashboard.accounts} />
        <DashboardAlerts alerts={dashboard.alerts} />
      </div>

      <div className="mt-4">
        <DashboardTransactions
          transactions={dashboard.transactions}
          serviceNames={dashboard.services}
        />
      </div>
    </>
  )
}

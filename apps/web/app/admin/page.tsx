import type { Metadata } from "next"
import { PiggyBank, Receipt, TrendingUp, Wallet } from "lucide-react"

import { AccountBalances } from "@/components/admin/account-balances"
import { AdminPageHeader } from "@/components/admin/admin-page"
import { CashflowChart } from "@/components/admin/cashflow-chart"
import { DashboardAlerts } from "@/components/admin/dashboard-alerts"
import { DashboardTransactions } from "@/components/admin/dashboard-transactions"
import { DevelopmentDataNotice } from "@/components/admin/development-data-notice"
import { SummaryCard } from "@/components/admin/summary-card"
import { developmentDashboardData } from "@/lib/admin/development-data"
import { formatIrr } from "@/lib/admin/format"

export const metadata: Metadata = {
  title: {
    absolute: "Dashboard — OBH Admin",
  },
}

const summaryCards = [
  {
    id: "balance",
    label: "Total business balance",
    value: developmentDashboardData.summary.totalBalance,
    hint: "Across sample accounts",
    icon: Wallet,
    change: "+6.2%",
    changeTone: "positive" as const,
  },
  {
    id: "revenue",
    label: "Revenue",
    value: developmentDashboardData.summary.revenue,
    hint: "vs previous sample period",
    icon: TrendingUp,
    change: "+12.8%",
    changeTone: "positive" as const,
  },
  {
    id: "expenses",
    label: "Expenses",
    value: developmentDashboardData.summary.expenses,
    hint: "vs previous sample period",
    icon: Receipt,
    change: "+4.1%",
    changeTone: "negative" as const,
  },
  {
    id: "profit",
    label: "Net profit",
    value: developmentDashboardData.summary.netProfit,
    hint: "vs previous sample period",
    icon: PiggyBank,
    change: "+18.4%",
    changeTone: "positive" as const,
  },
]

export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Overview"
        title="Financial overview"
        description="A complete dashboard interface prepared for real OBH data. The components below are interactive, but every figure is clearly identified development data."
      />

      <DevelopmentDataNotice />

      <section aria-labelledby="summary-heading" className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Summary
            </p>
            <h2
              id="summary-heading"
              className="mt-2 text-xl font-medium tracking-[-0.025em]"
            >
              Sample period · {developmentDashboardData.summary.periodLabel}
            </h2>
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
            />
          ))}
        </div>
      </section>

      <div className="mt-4">
        <CashflowChart data={developmentDashboardData.cashflow} />
      </div>

      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <AccountBalances accounts={developmentDashboardData.accounts} />
        <DashboardAlerts alerts={developmentDashboardData.alerts} />
      </div>

      <div className="mt-4">
        <DashboardTransactions
          transactions={developmentDashboardData.transactions}
        />
      </div>

      <p className="mt-6 text-center font-mono text-[9px] tracking-[0.1em] text-muted-foreground/45 uppercase">
        Development data / Not connected to financial records
      </p>
    </>
  )
}

import type { Metadata } from "next"
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  PieChart,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import { ProfitPeriodStatusBadge } from "@/components/admin/accounting/status-badges"
import { AdminPageHeader } from "@/components/admin/admin-page"
import { getFinancialReport } from "@/server/reports/queries"
import { resolveReportRange } from "@/server/reports/range"
import { formatAccountingDate, formatIrrDecimal } from "@/lib/admin/format"

export const metadata: Metadata = {
  title: "Reports",
}

type ReportPageProps = {
  searchParams: Promise<{
    from?: string | string[]
    to?: string | string[]
  }>
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function ReportTable({
  caption,
  headers,
  rows,
  empty,
  alignLast = false,
}: {
  caption: string
  headers: string[]
  rows: ReactNode[][]
  empty: string
  alignLast?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {headers.map((header, index) => (
              <th
                key={header}
                className={`px-4 py-3 font-mono text-[9px] font-medium tracking-[0.1em] text-muted-foreground/60 uppercase first:pl-5 last:pr-5 ${
                  alignLast && index === headers.length - 1 ? "text-right" : ""
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-5 py-8 text-center text-[11px] text-muted-foreground"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/70 last:border-b-0"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 text-xs first:pl-5 last:pr-5 ${
                      alignLast && cellIndex === row.length - 1
                        ? "text-right tabular-nums"
                        : ""
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function CheckStatus({ status }: { status: "pass" | "warn" | "fail" }) {
  if (status === "fail") {
    return (
      <Badge variant="danger">
        <XCircle aria-hidden="true" className="size-3" />
        Fail
      </Badge>
    )
  }

  if (status === "warn") {
    return (
      <Badge variant="warning">
        <AlertTriangle aria-hidden="true" className="size-3" />
        Review
      </Badge>
    )
  }

  return (
    <Badge variant="success">
      <CheckCircle2 aria-hidden="true" className="size-3" />
      Pass
    </Badge>
  )
}

export default async function AdminReportsPage({
  searchParams,
}: ReportPageProps) {
  const params = await searchParams
  const range = resolveReportRange(
    firstValue(params.from),
    firstValue(params.to)
  )
  const report = await getFinancialReport(range)
  const query = `from=${range.from}&to=${range.to}`
  const checkCounts = report.checks.reduce(
    (counts, check) => {
      counts[check.status] += 1
      return counts
    },
    { pass: 0, warn: 0, fail: 0 }
  )

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Accounting"
        title="Reports"
        description="Date-filtered cash-basis financial reporting, provider reconciliation summary, CSV exports, and consistency checks. TEST payment records are excluded."
        actions={
          <Badge variant={checkCounts.fail > 0 ? "danger" : "outline"}>
            {checkCounts.fail > 0
              ? `${checkCounts.fail} checks failed`
              : "Checks reviewed"}
          </Badge>
        }
      />

      <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card/40 p-4 lg:flex-row lg:items-end">
        <form
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="space-y-2">
            <label
              htmlFor="report-from"
              className="text-[10px] text-muted-foreground"
            >
              From
            </label>
            <input
              id="report-from"
              name="from"
              type="date"
              defaultValue={range.from}
              className="h-10 rounded-xl border border-input bg-white/[0.035] px-3 text-xs text-foreground"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="report-to"
              className="text-[10px] text-muted-foreground"
            >
              To
            </label>
            <input
              id="report-to"
              name="to"
              type="date"
              defaultValue={range.to}
              className="h-10 rounded-xl border border-input bg-white/[0.035] px-3 text-xs text-foreground"
            />
          </div>
          <button type="submit" className={buttonVariants({ size: "sm" })}>
            Apply filters
          </button>
          <a
            href="/admin/reports"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Current month
          </a>
        </form>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["summary", "Summary CSV"],
              ["payments", "Payments CSV"],
              ["expenses", "Expenses CSV"],
              ["distributions", "Distributions CSV"],
            ] as const
          ).map(([type, label]) => (
            <a
              key={type}
              href={`/admin/reports/export?type=${type}&${query}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download aria-hidden="true" className="size-3.5" />
              {label}
            </a>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Reporting range: {formatAccountingDate(range.from)} —{" "}
        {formatAccountingDate(range.to)} · Asia/Tehran ledger boundaries · cash
        basis
      </p>

      {range.invalidMessage ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs text-danger"
        >
          {range.invalidMessage} Showing the current month instead.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingStat
          label="Net operating"
          value={formatIrrDecimal(report.summary.netOperating)}
          hint="LIVE payments + manual income − paid expenses − settled fees."
          icon={TrendingUp}
        />
        <AccountingStat
          label="LIVE payment revenue"
          value={formatIrrDecimal(report.summary.paymentRevenue)}
          hint="Completed LIVE payments only."
          icon={Wallet}
        />
        <AccountingStat
          label="Manual income"
          value={formatIrrDecimal(report.summary.manualIncome)}
          hint="Additional income recorded in the range."
          icon={CircleDollarSign}
        />
        <AccountingStat
          label="Paid expenses"
          value={formatIrrDecimal(report.summary.paidExpenses)}
          hint={`${formatIrrDecimal(report.summary.pendingExpenses)} pending excluded.`}
          icon={Receipt}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingStat
          label="Settled provider fees"
          value={formatIrrDecimal(report.summary.providerFees)}
          hint="Settled LIVE provider fees in the range."
          icon={Scale}
        />
        <AccountingStat
          label="Approved distributable"
          value={formatIrrDecimal(report.summary.distributable)}
          hint="Approved/closed profit periods ending in the range."
          icon={PieChart}
        />
        <AccountingStat
          label="Payouts paid"
          value={formatIrrDecimal(report.summary.payoutsPaid)}
          hint="Completed shareholder payouts dated in the range."
          icon={Banknote}
        />
        <AccountingStat
          label="TEST payments excluded"
          value={String(report.summary.testPaymentCount)}
          hint={`${formatIrrDecimal(report.summary.testPaymentAmount)} simulated, excluded.`}
          icon={Clock}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="border-b border-border p-4">
            <p className="text-xs font-medium">Revenue by service</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Completed LIVE payments in the reporting range.
            </p>
          </div>
          <ReportTable
            caption="Revenue by service"
            headers={["Service", "Payments", "Revenue"]}
            rows={report.serviceRevenue.map((row) => [
              row.service,
              String(row.count),
              formatIrrDecimal(row.amount),
            ])}
            empty="No LIVE payment revenue in this range."
            alignLast
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="border-b border-border p-4">
            <p className="text-xs font-medium">Expenses by category</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Paid expenses in the reporting range.
            </p>
          </div>
          <ReportTable
            caption="Expenses by category"
            headers={["Category", "Records", "Amount"]}
            rows={report.expenseCategories.map((row) => [
              row.category,
              String(row.count),
              formatIrrDecimal(row.amount),
            ])}
            empty="No paid expenses in this range."
            alignLast
          />
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="border-b border-border p-4">
          <p className="text-xs font-medium">Income by source</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Manual income records in the reporting range.
          </p>
        </div>
        <ReportTable
          caption="Income by source"
          headers={["Source", "Records", "Amount"]}
          rows={report.incomeSources.map((row) => [
            row.source,
            String(row.count),
            formatIrrDecimal(row.amount),
          ])}
          empty="No manual income in this range."
          alignLast
        />
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <p className="text-xs font-medium">Consistency checks</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {checkCounts.pass} pass · {checkCounts.warn} review ·{" "}
              {checkCounts.fail} fail
            </p>
          </div>
          <a
            href="/admin/reconciliation"
            className={buttonVariants({ variant: "ghost", size: "xs" })}
          >
            Reconciliation
            <ArrowUpRight aria-hidden="true" className="size-3" />
          </a>
        </div>
        <div className="grid gap-0 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="divide-y divide-border">
            {report.checks
              .slice(0, Math.ceil(report.checks.length / 2))
              .map((check) => (
                <div
                  key={check.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
                  <div>
                    <p className="text-[11px] font-medium">{check.label}</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                      {check.status === "pass"
                        ? "No issues found."
                        : `${check.count} · ${check.detail}`}
                    </p>
                  </div>
                  <CheckStatus status={check.status} />
                </div>
              ))}
          </div>
          <div className="divide-y divide-border">
            {report.checks
              .slice(Math.ceil(report.checks.length / 2))
              .map((check) => (
                <div
                  key={check.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
                  <div>
                    <p className="text-[11px] font-medium">{check.label}</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                      {check.status === "pass"
                        ? "No issues found."
                        : `${check.count} · ${check.detail}`}
                    </p>
                  </div>
                  <CheckStatus status={check.status} />
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="border-b border-border p-4">
          <p className="text-xs font-medium">Profit periods ending in range</p>
        </div>
        <ReportTable
          caption="Profit periods ending in range"
          headers={[
            "Period",
            "Status",
            "Revenue",
            "Expenses",
            "Net profit",
            "Distributable",
            "Paid out",
          ]}
          rows={report.periods.map((period) => [
            period.month,
            <ProfitPeriodStatusBadge
              key={period.id}
              status={
                period.status as "DRAFT" | "APPROVED" | "CLOSED" | "VOIDED"
              }
            />,
            formatIrrDecimal(period.totalRevenue),
            formatIrrDecimal(period.totalExpenses),
            formatIrrDecimal(period.netProfit),
            formatIrrDecimal(period.distributableAmount),
            formatIrrDecimal(period.totalPaid),
          ])}
          empty="No profit periods end in this range."
        />
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="border-b border-border p-4">
          <p className="text-xs font-medium">
            Latest LIVE provider reconciliations
          </p>
        </div>
        <ReportTable
          caption="Latest provider reconciliations"
          headers={["Account", "As of", "Actual", "Calculated", "Difference"]}
          rows={report.reconciliations.map((reconciliation) => [
            reconciliation.account,
            formatAccountingDate(reconciliation.asOf),
            formatIrrDecimal(reconciliation.actualBalance),
            formatIrrDecimal(reconciliation.calculatedBalance),
            <span
              key={reconciliation.id}
              className={
                reconciliation.difference === "0.00"
                  ? "text-success"
                  : "text-danger"
              }
            >
              {formatIrrDecimal(reconciliation.difference)}
            </span>,
          ])}
          empty="No LIVE provider reconciliations recorded."
          alignLast
        />
      </section>

      <p className="mt-5 text-[10px] leading-5 text-muted-foreground/55">
        Reports use accounting dates and Asia/Tehran boundaries. Payment revenue
        is recognized when a LIVE payment is completed and verified. TEST
        payments are excluded. Formal revenue-recognition policy beyond this
        cash basis remains pending.
      </p>
    </>
  )
}

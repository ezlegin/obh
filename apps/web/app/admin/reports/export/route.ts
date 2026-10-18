import { requireAdmin } from "@/lib/auth/guards"
import { resolveReportRange } from "@/server/reports/range"
import {
  getDistributionExportRows,
  getExpenseExportRows,
  getFinancialReport,
  getPaymentExportRows,
} from "@/server/reports/queries"
import { csvNumber, escapeCsvCell, toCsv } from "@/server/reports/csv"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const types = ["summary", "payments", "expenses", "distributions"] as const
type ExportType = (typeof types)[number]

export async function GET(request: Request) {
  await requireAdmin()
  const url = new URL(request.url)
  const type = url.searchParams.get("type") as ExportType | null

  if (!type || !types.includes(type)) {
    return new Response("Invalid export type.", { status: 400 })
  }

  const range = resolveReportRange(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined
  )

  if (range.invalidMessage) {
    return new Response(range.invalidMessage, { status: 400 })
  }

  let rows: string[][]

  if (type === "summary") {
    const report = await getFinancialReport(range)
    const checkCounts = report.checks.reduce(
      (counts, check) => {
        counts[check.status] += 1
        return counts
      },
      { pass: 0, warn: 0, fail: 0 }
    )

    rows = [
      ["Metric", "Value"],
      ["From", escapeCsvCell(report.range.from)],
      ["To", escapeCsvCell(report.range.to)],
      ["Payment revenue", csvNumber(report.summary.paymentRevenue)],
      ["Manual income", csvNumber(report.summary.manualIncome)],
      ["Paid expenses", csvNumber(report.summary.paidExpenses)],
      ["Pending expenses", csvNumber(report.summary.pendingExpenses)],
      ["Settled provider fees", csvNumber(report.summary.providerFees)],
      ["Net operating", csvNumber(report.summary.netOperating)],
      ["Approved distributable", csvNumber(report.summary.distributable)],
      ["Payouts paid", csvNumber(report.summary.payoutsPaid)],
      ["TEST payments excluded", csvNumber(report.summary.testPaymentAmount)],
      [
        "TEST payment count",
        csvNumber(String(report.summary.testPaymentCount)),
      ],
      ["Checks passed", csvNumber(String(checkCounts.pass))],
      ["Checks warned", csvNumber(String(checkCounts.warn))],
      ["Checks failed", csvNumber(String(checkCounts.fail))],
    ]
  } else if (type === "payments") {
    const payments = await getPaymentExportRows(range)
    rows = [
      [
        "Reference",
        "Completed at",
        "Service",
        "Provider",
        "Amount",
        "Currency",
        "Status",
      ],
      ...payments.map((payment) => [
        escapeCsvCell(payment.reference),
        escapeCsvCell(payment.completedAt),
        escapeCsvCell(payment.service),
        escapeCsvCell(payment.provider),
        csvNumber(payment.amount),
        escapeCsvCell(payment.currency),
        escapeCsvCell(payment.status),
      ]),
    ]
  } else if (type === "expenses") {
    const expenses = await getExpenseExportRows(range)
    rows = [
      [
        "Date",
        "Category",
        "Description",
        "Payment source",
        "Amount",
        "Currency",
        "Status",
        "External reference",
      ],
      ...expenses.map((expense) => [
        escapeCsvCell(expense.date),
        escapeCsvCell(expense.category),
        escapeCsvCell(expense.description),
        escapeCsvCell(expense.source),
        csvNumber(expense.amount),
        escapeCsvCell(expense.currency),
        escapeCsvCell(expense.status),
        escapeCsvCell(expense.externalReference),
      ]),
    ]
  } else {
    const distributions = await getDistributionExportRows(range)
    rows = [
      [
        "Period",
        "Period status",
        "Shareholder",
        "Ownership %",
        "Allocated",
        "Distribution status",
        "Payout amount",
        "Payout status",
        "Payout date",
        "Payout account",
      ],
      ...distributions.map((distribution) => [
        escapeCsvCell(distribution.period),
        escapeCsvCell(distribution.status),
        escapeCsvCell(distribution.shareholder),
        csvNumber(distribution.percentage),
        csvNumber(distribution.allocated),
        escapeCsvCell(distribution.distributionStatus),
        csvNumber(distribution.payoutAmount),
        escapeCsvCell(distribution.payoutStatus),
        escapeCsvCell(distribution.payoutDate),
        escapeCsvCell(distribution.payoutAccount),
      ]),
    ]
  }

  const csv = `\uFEFF${toCsv(rows)}`
  const fileName = `obh-${type}-${range.from}-to-${range.to}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { formatDateOnly, formatMonthLabel } from "@/server/accounting/dates"
import {
  runConsistencyChecks,
  type ConsistencyCheck,
} from "@/server/reports/checks"
import type { ReportRange } from "@/server/reports/range"

export type FinancialReport = {
  range: { from: string; to: string }
  summary: {
    paymentRevenue: string
    manualIncome: string
    paidExpenses: string
    pendingExpenses: string
    providerFees: string
    netOperating: string
    payoutsPaid: string
    distributable: string
    testPaymentAmount: string
    testPaymentCount: number
    pendingExpenseCount: number
  }
  serviceRevenue: Array<{
    service: string
    amount: string
    count: number
  }>
  /** LIVE payment attempts created in range, by service and gateway. */
  gatewayBreakdown: Array<{
    service: string
    gateway: string
    attempts: number
    completedCount: number
    completedAmount: string
    failedCount: number
    pendingCount: number
    /** Completed ÷ finished (completed + failed + expired), as a percent. */
    successRate: string | null
  }>
  /** Whether each active service is actually reporting payments to OBH. */
  reportingHealth: Array<{
    service: string
    domain: string
    activeCredentials: number
    lastReportAt: string | null
    /** Pending for over two hours: the service's reconcile job is not running. */
    stalePending: number
    status: "reporting" | "stale" | "silent"
  }>
  expenseCategories: Array<{
    category: string
    amount: string
    count: number
  }>
  incomeSources: Array<{
    source: string
    amount: string
    count: number
  }>
  periods: Array<{
    id: string
    month: string
    status: string
    totalRevenue: string
    totalExpenses: string
    netProfit: string
    distributableAmount: string
    totalPaid: string
  }>
  reconciliations: Array<{
    id: string
    account: string
    asOf: string
    actualBalance: string
    calculatedBalance: string
    difference: string
  }>
  checks: ConsistencyCheck[]
}

function addToGroup(
  groups: Map<string, { amount: Prisma.Decimal; count: number }>,
  key: string,
  amount: Prisma.Decimal
) {
  const current = groups.get(key) ?? {
    amount: new Prisma.Decimal(0),
    count: 0,
  }
  groups.set(key, {
    amount: current.amount.plus(amount),
    count: current.count + 1,
  })
}

const STALE_PENDING_MS = 2 * 60 * 60 * 1000
const SILENT_AFTER_MS = 7 * 24 * 60 * 60 * 1000

async function getGatewayBreakdown(range: ReportRange) {
  const db = getDb()
  const [groups, services, providers] = await Promise.all([
    db.payment.groupBy({
      by: ["serviceId", "providerId", "status"],
      where: {
        environment: "LIVE",
        createdAt: { gte: range.startInstant, lt: range.endInstant },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.connectedService.findMany({ select: { id: true, name: true } }),
    db.paymentProvider.findMany({ select: { id: true, name: true } }),
  ])
  const serviceNames = new Map(services.map((item) => [item.id, item.name]))
  const providerNames = new Map(providers.map((item) => [item.id, item.name]))

  type Row = FinancialReport["gatewayBreakdown"][number] & {
    amount: Prisma.Decimal
    finished: number
  }
  const rows = new Map<string, Row>()

  for (const group of groups) {
    const key = `${group.serviceId}:${group.providerId}`
    const row = rows.get(key) ?? {
      service: serviceNames.get(group.serviceId ?? "") ?? "Unassigned",
      gateway: providerNames.get(group.providerId ?? "") ?? "Unknown gateway",
      attempts: 0,
      completedCount: 0,
      completedAmount: "0.00",
      failedCount: 0,
      pendingCount: 0,
      successRate: null,
      amount: new Prisma.Decimal(0),
      finished: 0,
    }
    const count = group._count._all
    row.attempts += count

    if (group.status === "COMPLETED") {
      row.completedCount += count
      row.amount = row.amount.plus(group._sum.amount ?? 0)
      row.finished += count
    } else if (group.status === "PENDING") {
      row.pendingCount += count
    } else {
      row.failedCount += count
      if (group.status !== "CANCELLED") {
        row.finished += count
      }
    }
    rows.set(key, row)
  }

  return [...rows.values()]
    .map(({ amount, finished, ...row }) => ({
      ...row,
      completedAmount: amount.toFixed(2),
      successRate:
        finished > 0
          ? ((row.completedCount / finished) * 100).toFixed(1)
          : null,
    }))
    .sort((left, right) =>
      new Prisma.Decimal(right.completedAmount).comparedTo(left.completedAmount)
    )
}

export async function getReportingHealth(): Promise<
  FinancialReport["reportingHealth"]
> {
  const db = getDb()
  const now = Date.now()
  const [services, lastReports, stale] = await Promise.all([
    db.connectedService.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        domain: true,
        _count: {
          select: { credentials: { where: { revokedAt: null } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.payment.groupBy({
      by: ["serviceId"],
      where: { serviceId: { not: null } },
      _max: { updatedAt: true },
    }),
    db.payment.groupBy({
      by: ["serviceId"],
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(now - STALE_PENDING_MS) },
      },
      _count: { _all: true },
    }),
  ])
  const lastByService = new Map(
    lastReports.map((item) => [item.serviceId, item._max.updatedAt])
  )
  const staleByService = new Map(
    stale.map((item) => [item.serviceId, item._count._all])
  )

  return services.map((service) => {
    const last = lastByService.get(service.id) ?? null
    const stalePending = staleByService.get(service.id) ?? 0
    const status: FinancialReport["reportingHealth"][number]["status"] =
      !last || now - last.getTime() > SILENT_AFTER_MS
        ? "silent"
        : stalePending > 0
          ? "stale"
          : "reporting"

    return {
      service: service.name,
      domain: service.domain,
      activeCredentials: service._count.credentials,
      lastReportAt: last ? last.toISOString() : null,
      stalePending,
      status,
    }
  })
}

export async function getFinancialReport(
  range: ReportRange
): Promise<FinancialReport> {
  const db = getDb()
  const fromDate = new Date(`${range.from}T00:00:00.000Z`)
  const toDate = new Date(`${range.to}T00:00:00.000Z`)

  const [
    payments,
    testPayments,
    incomeRows,
    paidExpenses,
    pendingExpenses,
    providerFees,
    payouts,
    periods,
    reconciliations,
    checks,
    gatewayBreakdown,
    reportingHealth,
  ] = await Promise.all([
    db.payment.findMany({
      where: {
        status: "COMPLETED",
        environment: "LIVE",
        completedAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
      },
      include: { service: { select: { name: true } } },
    }),
    db.payment.aggregate({
      where: {
        status: "COMPLETED",
        environment: "TEST",
        completedAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.income.findMany({
      where: {
        receivedOn: { gte: fromDate, lte: toDate },
      },
    }),
    db.expense.findMany({
      where: {
        status: "PAID",
        spentOn: { gte: fromDate, lte: toDate },
      },
      include: { category: { select: { name: true } } },
    }),
    db.expense.aggregate({
      where: {
        status: "PENDING",
        spentOn: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.providerFee.aggregate({
      where: {
        status: "SETTLED",
        currency: "IRR",
        chargedAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
        providerAccount: { environment: "LIVE" },
      },
      _sum: { amount: true },
    }),
    db.shareholderPayout.findMany({
      where: {
        status: "COMPLETED",
        paidAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
      },
      include: {
        profitDistribution: { select: { profitPeriodId: true } },
      },
    }),
    db.profitPeriod.findMany({
      where: {
        endsOn: { gte: fromDate, lte: toDate },
      },
      orderBy: { startsOn: "desc" },
      include: {
        distributions: {
          include: { payouts: true },
        },
      },
    }),
    db.accountReconciliation.findMany({
      where: { account: { environment: "LIVE" } },
      orderBy: { asOf: "desc" },
      take: 12,
      include: { account: { select: { name: true } } },
    }),
    runConsistencyChecks(range),
    getGatewayBreakdown(range),
    getReportingHealth(),
  ])

  const zero = new Prisma.Decimal(0)
  const paymentRevenue = payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    zero
  )
  const manualIncome = incomeRows.reduce(
    (sum, income) => sum.plus(income.amount),
    zero
  )
  const expenseTotal = paidExpenses.reduce(
    (sum, expense) => sum.plus(expense.amount),
    zero
  )
  const feeTotal = providerFees._sum.amount ?? zero
  const payoutsTotal = payouts.reduce(
    (sum, payout) => sum.plus(payout.amount),
    zero
  )
  const distributable = periods.reduce(
    (sum, period) =>
      period.status === "DRAFT"
        ? sum
        : sum.plus(period.distributableAmount ?? zero),
    zero
  )

  const serviceGroups = new Map<
    string,
    { amount: Prisma.Decimal; count: number }
  >()
  const categoryGroups = new Map<
    string,
    { amount: Prisma.Decimal; count: number }
  >()
  const sourceGroups = new Map<
    string,
    { amount: Prisma.Decimal; count: number }
  >()

  for (const payment of payments) {
    addToGroup(
      serviceGroups,
      payment.service?.name ?? "Unassigned",
      payment.amount
    )
  }
  for (const expense of paidExpenses) {
    addToGroup(categoryGroups, expense.category.name, expense.amount)
  }
  for (const income of incomeRows) {
    addToGroup(sourceGroups, income.source ?? "Unspecified", income.amount)
  }

  return {
    range: { from: range.from, to: range.to },
    summary: {
      paymentRevenue: paymentRevenue.toFixed(2),
      manualIncome: manualIncome.toFixed(2),
      paidExpenses: expenseTotal.toFixed(2),
      pendingExpenses: (pendingExpenses._sum.amount ?? zero).toFixed(2),
      providerFees: feeTotal.toFixed(2),
      netOperating: paymentRevenue
        .plus(manualIncome)
        .minus(expenseTotal)
        .minus(feeTotal)
        .toFixed(2),
      payoutsPaid: payoutsTotal.toFixed(2),
      distributable: distributable.toFixed(2),
      testPaymentAmount: (testPayments._sum.amount ?? zero).toFixed(2),
      testPaymentCount: testPayments._count._all,
      pendingExpenseCount: pendingExpenses._count._all,
    },
    serviceRevenue: [...serviceGroups.entries()]
      .map(([service, group]) => ({
        service,
        amount: group.amount.toFixed(2),
        count: group.count,
      }))
      .sort((left, right) =>
        new Prisma.Decimal(right.amount).comparedTo(left.amount)
      ),
    gatewayBreakdown,
    reportingHealth,
    expenseCategories: [...categoryGroups.entries()]
      .map(([category, group]) => ({
        category,
        amount: group.amount.toFixed(2),
        count: group.count,
      }))
      .sort((left, right) =>
        new Prisma.Decimal(right.amount).comparedTo(left.amount)
      ),
    incomeSources: [...sourceGroups.entries()]
      .map(([source, group]) => ({
        source,
        amount: group.amount.toFixed(2),
        count: group.count,
      }))
      .sort((left, right) =>
        new Prisma.Decimal(right.amount).comparedTo(left.amount)
      ),
    periods: periods.map((period) => ({
      id: period.id,
      month: formatMonthLabel(formatDateOnly(period.startsOn).slice(0, 7)),
      status: period.status,
      totalRevenue: (period.totalRevenue ?? zero).toFixed(2),
      totalExpenses: (period.totalExpenses ?? zero).toFixed(2),
      netProfit: (period.netProfit ?? zero).toFixed(2),
      distributableAmount: (period.distributableAmount ?? zero).toFixed(2),
      totalPaid: period.distributions
        .flatMap((distribution) => distribution.payouts)
        .filter((payout) => payout.status === "COMPLETED")
        .reduce((sum, payout) => sum.plus(payout.amount), zero)
        .toFixed(2),
    })),
    reconciliations: reconciliations.map((reconciliation) => ({
      id: reconciliation.id,
      account: reconciliation.account.name,
      asOf: formatDateOnly(reconciliation.asOf),
      actualBalance: reconciliation.actualBalance.toFixed(2),
      calculatedBalance: reconciliation.calculatedBalance.toFixed(2),
      difference: reconciliation.difference.toFixed(2),
    })),
    checks,
  }
}

export async function getPaymentExportRows(range: ReportRange) {
  const payments = await getDb().payment.findMany({
    where: {
      status: "COMPLETED",
      environment: "LIVE",
      completedAt: { gte: range.startInstant, lt: range.endInstant },
    },
    orderBy: { completedAt: "asc" },
    include: {
      service: { select: { name: true } },
      provider: { select: { name: true } },
    },
  })

  return payments.map((payment) => ({
    reference: payment.reference,
    completedAt: payment.completedAt?.toISOString() ?? "",
    service: payment.service?.name ?? "",
    provider: payment.provider?.name ?? "",
    amount: payment.amount.toFixed(2),
    currency: payment.currency,
    status: payment.status,
  }))
}

export async function getExpenseExportRows(range: ReportRange) {
  const fromDate = new Date(`${range.from}T00:00:00.000Z`)
  const toDate = new Date(`${range.to}T00:00:00.000Z`)
  const expenses = await getDb().expense.findMany({
    where: {
      spentOn: { gte: fromDate, lte: toDate },
    },
    orderBy: { spentOn: "asc" },
    include: {
      category: { select: { name: true } },
      account: { select: { name: true } },
    },
  })

  return expenses.map((expense) => ({
    date: formatDateOnly(expense.spentOn),
    category: expense.category.name,
    description: expense.description,
    source: expense.account?.name ?? "",
    amount: expense.amount.toFixed(2),
    currency: expense.currency,
    status: expense.status,
    externalReference: expense.externalReference ?? "",
  }))
}

export async function getDistributionExportRows(range: ReportRange) {
  const fromDate = new Date(`${range.from}T00:00:00.000Z`)
  const toDate = new Date(`${range.to}T00:00:00.000Z`)
  const periods = await getDb().profitPeriod.findMany({
    where: { endsOn: { gte: fromDate, lte: toDate } },
    orderBy: { startsOn: "asc" },
    include: {
      distributions: {
        include: {
          shareholder: { select: { name: true } },
          payouts: {
            include: { account: { select: { name: true } } },
          },
        },
      },
    },
  })

  return periods.flatMap((period) =>
    period.distributions.map((distribution) => ({
      period: formatMonthLabel(formatDateOnly(period.startsOn).slice(0, 7)),
      status: period.status,
      shareholder: distribution.shareholder.name,
      percentage: distribution.percentageSnapshot.toFixed(4),
      allocated: distribution.allocatedAmount.toFixed(2),
      distributionStatus: distribution.status,
      payoutAmount: distribution.payouts[0]?.amount.toFixed(2) ?? "",
      payoutStatus: distribution.payouts[0]?.status ?? "",
      payoutDate: distribution.payouts[0]?.paidAt?.toISOString() ?? "",
      payoutAccount: distribution.payouts[0]?.account?.name ?? "",
    }))
  )
}

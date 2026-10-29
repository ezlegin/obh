import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import {
  addDays,
  formatDateOnly,
  formatMonthLabel,
  parseDateOnly,
  todayDateOnlyInTehran,
} from "@/server/accounting/dates"
import { settleDueInstallments } from "@/server/payments/installments/installment-service"
import { calculateProviderBalance } from "@/server/reconciliation/service"
import { getReportingHealth } from "@/server/reports/queries"

export type DashboardPeriod =
  "today" | "weekly" | "monthly" | "3m" | "6m" | "annual"

export const DASHBOARD_PERIOD_OPTIONS: ReadonlyArray<{
  id: DashboardPeriod
  label: string
}> = [
  { id: "today", label: "Today" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "3m", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "annual", label: "Annual" },
]

export function parseDashboardPeriod(
  value: string | string[] | undefined
): DashboardPeriod {
  const raw = Array.isArray(value) ? value[0] : value
  if (
    raw === "today" ||
    raw === "weekly" ||
    raw === "monthly" ||
    raw === "3m" ||
    raw === "6m" ||
    raw === "annual"
  ) {
    return raw
  }
  return "monthly"
}

export type DashboardTransactionStatus =
  "completed" | "pending" | "failed" | "cancelled" | "expired"

export type DashboardTransaction = {
  id: string
  reference: string
  gatewayOrderId: string
  service: string
  description: string
  provider: string
  environment: "LIVE" | "TEST"
  amount: number
  currency: string
  status: DashboardTransactionStatus
  occurredAt: string
  externalOrderId: string
  verifiedAt: string | null
  traceNumber: string | null
  providerReference: string | null
  maskedCardNumber: string | null
  gatewayResultText: string | null
}

export type DashboardAccount = {
  id: string
  name: string
  kind: "Provider account" | "Business account"
  environment: "Live" | "Simulator" | "Bank"
  actualBalance: number
  calculatedBalance: number
  pendingAmount: number
  reconciledAt: string | null
}

export type DashboardAlert = {
  id: string
  title: string
  description: string
  severity: "warning" | "info"
}

export type DashboardCashflowPoint = {
  label: string
  revenue: number
  expenses: number
}

export type DashboardData = {
  period: DashboardPeriod
  summary: {
    totalBalance: number
    /** Total balance if every installment purchase had been paid in full. */
    allCashBalance: number
    /** Installment amounts the gateways still owe the business. */
    installmentReceivable: number
    revenue: number
    expenses: number
    netProfit: number
    periodLabel: string
    comparisonHint: string
    accountCount: number
    completedPaymentCount: number
    paidExpenseCount: number
    revenueChangeLabel: string
    revenueChangeTone: "positive" | "negative" | "neutral"
    expensesChangeLabel: string
    expensesChangeTone: "positive" | "negative" | "neutral"
    profitChangeLabel: string
    profitChangeTone: "positive" | "negative" | "neutral"
  }
  cashflowRangeLabel: string
  cashflowBadgeLabel: string
  cashflow: DashboardCashflowPoint[]
  accounts: DashboardAccount[]
  transactions: DashboardTransaction[]
  services: string[]
  alerts: DashboardAlert[]
}

const TEHRAN_OFFSET = "+03:30"

function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (!value) {
    return 0
  }
  return Number(value.toFixed(0))
}

function formatDayShortLabel(dateOnly: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`))
}

function formatDayWithYearLabel(dateOnly: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`))
}

function formatMonthShortLabel(monthValue: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${monthValue}-01T00:00:00.000Z`))
}

function toTehranDateOnly(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(instant)
}

function toTehranHour(instant: Date): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Tehran",
  }).format(instant)
  return Number(formatted) % 24
}

type PeriodWindow = {
  period: DashboardPeriod
  days: number
  currentFromStr: string
  currentToStr: string
  currentFromDate: Date
  currentToDate: Date
  currentStartInstant: Date
  currentEndInstant: Date
  prevFromDate: Date
  prevToDate: Date
  prevStartInstant: Date
  prevEndInstant: Date
  periodLabel: string
  comparisonHint: string
  cashflowRangeLabel: string
  cashflowBadgeLabel: string
}

function resolvePeriodWindow(period: DashboardPeriod): PeriodWindow {
  const todayStr = todayDateOnlyInTehran()
  const todayDate = parseDateOnly(todayStr)
  const tomorrowStr = formatDateOnly(addDays(todayDate, 1))

  const configByPeriod: Record<
    DashboardPeriod,
    {
      days: number
      titlePrefix: string
      comparisonHint: string
      badgeLabel: string
    }
  > = {
    today: {
      days: 1,
      titlePrefix: "Today",
      comparisonHint: "vs yesterday",
      badgeLabel: "Today",
    },
    weekly: {
      days: 7,
      titlePrefix: "Last 7 days",
      comparisonHint: "vs previous 7 days",
      badgeLabel: "Last 7 days",
    },
    monthly: {
      days: 30,
      titlePrefix: "Last 30 days",
      comparisonHint: "vs previous 30 days",
      badgeLabel: "Last 30 days",
    },
    "3m": {
      days: 90,
      titlePrefix: "Last 3 months",
      comparisonHint: "vs previous 3 months",
      badgeLabel: "Last 3 months",
    },
    "6m": {
      days: 180,
      titlePrefix: "Last 6 months",
      comparisonHint: "vs previous 6 months",
      badgeLabel: "Last 6 months",
    },
    annual: {
      days: 365,
      titlePrefix: "Annual (12 months)",
      comparisonHint: "vs previous 12 months",
      badgeLabel: "Last 12 months",
    },
  }

  const cfg = configByPeriod[period]
  const currentFromDate = addDays(todayDate, -(cfg.days - 1))
  const currentFromStr = formatDateOnly(currentFromDate)
  const currentToDate = todayDate
  const currentToStr = todayStr

  const prevToDate = addDays(currentFromDate, -1)
  const prevFromDate = addDays(prevToDate, -(cfg.days - 1))
  const prevFromStr = formatDateOnly(prevFromDate)

  const currentStartInstant = new Date(
    `${currentFromStr}T00:00:00${TEHRAN_OFFSET}`
  )
  const currentEndInstant = new Date(`${tomorrowStr}T00:00:00${TEHRAN_OFFSET}`)

  const prevStartInstant = new Date(`${prevFromStr}T00:00:00${TEHRAN_OFFSET}`)
  const prevEndInstant = currentStartInstant

  const rangeDisplay =
    cfg.days === 1
      ? formatDayWithYearLabel(todayStr)
      : `${formatDayShortLabel(currentFromStr)} – ${formatDayWithYearLabel(currentToStr)}`

  return {
    period,
    days: cfg.days,
    currentFromStr,
    currentToStr,
    currentFromDate,
    currentToDate,
    currentStartInstant,
    currentEndInstant,
    prevFromDate,
    prevToDate,
    prevStartInstant,
    prevEndInstant,
    periodLabel: `${cfg.titlePrefix} · ${rangeDisplay}`,
    comparisonHint: cfg.comparisonHint,
    cashflowRangeLabel: rangeDisplay,
    cashflowBadgeLabel: cfg.badgeLabel,
  }
}

function formatPercentageChange(
  current: number,
  previous: number,
  invertTone = false
): {
  label: string
  tone: "positive" | "negative" | "neutral"
} {
  if (previous === 0) {
    if (current === 0) {
      return { label: "0%", tone: "neutral" }
    }
    return {
      label: current > 0 ? "New in period" : "—",
      tone: current > 0 ? (invertTone ? "negative" : "positive") : "neutral",
    }
  }

  const ratio = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(ratio * 10) / 10
  if (rounded === 0) {
    return { label: "0%", tone: "neutral" }
  }

  const sign = rounded > 0 ? "+" : ""
  const isIncrease = rounded > 0
  const tone = invertTone
    ? isIncrease
      ? "negative"
      : "positive"
    : isIncrease
      ? "positive"
      : "negative"

  return {
    label: `${sign}${rounded.toFixed(1)}%`,
    tone,
  }
}

function mapPaymentStatus(
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "EXPIRED"
): DashboardTransactionStatus {
  switch (status) {
    case "COMPLETED":
      return "completed"
    case "PENDING":
      return "pending"
    case "FAILED":
      return "failed"
    case "CANCELLED":
      return "cancelled"
    case "EXPIRED":
      return "expired"
  }
}

function buildCashflowPoints(
  window: PeriodWindow,
  payments: Array<{
    amount: Prisma.Decimal
    completedAt: Date | null
    createdAt: Date
  }>,
  incomes: Array<{ amount: Prisma.Decimal; receivedOn: Date }>,
  expenses: Array<{ amount: Prisma.Decimal; spentOn: Date }>,
  fees: Array<{ amount: Prisma.Decimal; chargedAt: Date }>
): DashboardCashflowPoint[] {
  // 1) Today -> 8 three-hour buckets (00:00 .. 21:00)
  if (window.period === "today") {
    const buckets = Array.from({ length: 8 }, (_, idx) => {
      const hour = idx * 3
      return {
        label: `${String(hour).padStart(2, "0")}:00`,
        revenue: 0,
        expenses: 0,
      }
    })

    for (const payment of payments) {
      const hour = toTehranHour(payment.completedAt ?? payment.createdAt)
      const index = Math.min(7, Math.floor(hour / 3))
      buckets[index]!.revenue += toNumber(payment.amount)
    }

    for (const fee of fees) {
      const hour = toTehranHour(fee.chargedAt)
      const index = Math.min(7, Math.floor(hour / 3))
      buckets[index]!.expenses += toNumber(fee.amount)
    }

    // Date-only incomes and expenses on "today" are placed in the 09:00 bucket
    for (const income of incomes) {
      buckets[3]!.revenue += toNumber(income.amount)
    }
    for (const expense of expenses) {
      buckets[3]!.expenses += toNumber(expense.amount)
    }

    return buckets
  }

  // 2) Weekly (7 days) or Monthly (30 days) -> daily buckets
  if (window.period === "weekly" || window.period === "monthly") {
    const byDate = new Map<string, { revenue: number; expenses: number }>()
    const dateKeys: string[] = []

    for (let offset = window.days - 1; offset >= 0; offset -= 1) {
      const dayDate = addDays(window.currentToDate, -offset)
      const key = formatDateOnly(dayDate)
      dateKeys.push(key)
      byDate.set(key, { revenue: 0, expenses: 0 })
    }

    for (const payment of payments) {
      const key = toTehranDateOnly(payment.completedAt ?? payment.createdAt)
      const bucket = byDate.get(key)
      if (bucket) {
        bucket.revenue += toNumber(payment.amount)
      }
    }

    for (const income of incomes) {
      const key = formatDateOnly(income.receivedOn)
      const bucket = byDate.get(key)
      if (bucket) {
        bucket.revenue += toNumber(income.amount)
      }
    }

    for (const expense of expenses) {
      const key = formatDateOnly(expense.spentOn)
      const bucket = byDate.get(key)
      if (bucket) {
        bucket.expenses += toNumber(expense.amount)
      }
    }

    for (const fee of fees) {
      const key = toTehranDateOnly(fee.chargedAt)
      const bucket = byDate.get(key)
      if (bucket) {
        bucket.expenses += toNumber(fee.amount)
      }
    }

    return dateKeys.map((key) => {
      const bucket = byDate.get(key) ?? { revenue: 0, expenses: 0 }
      return {
        label: formatDayShortLabel(key),
        revenue: bucket.revenue,
        expenses: bucket.expenses,
      }
    })
  }

  // 3) 3 months (90 days) -> 13 weekly buckets
  if (window.period === "3m") {
    const bucketCount = 13
    const buckets: Array<{
      startKey: string
      endKey: string
      label: string
      revenue: number
      expenses: number
    }> = []

    for (let i = 0; i < bucketCount; i += 1) {
      const startDate = addDays(window.currentFromDate, i * 7)
      const endDate =
        i === bucketCount - 1 ? window.currentToDate : addDays(startDate, 6)
      const startKey = formatDateOnly(startDate)
      const endKey = formatDateOnly(endDate)
      buckets.push({
        startKey,
        endKey,
        label: formatDayShortLabel(startKey),
        revenue: 0,
        expenses: 0,
      })
    }

    const addByKey = (
      dateKey: string,
      kind: "revenue" | "expenses",
      amount: number
    ) => {
      const target = buckets.find(
        (b) => dateKey >= b.startKey && dateKey <= b.endKey
      )
      if (target) {
        target[kind] += amount
      }
    }

    for (const payment of payments) {
      addByKey(
        toTehranDateOnly(payment.completedAt ?? payment.createdAt),
        "revenue",
        toNumber(payment.amount)
      )
    }
    for (const income of incomes) {
      addByKey(
        formatDateOnly(income.receivedOn),
        "revenue",
        toNumber(income.amount)
      )
    }
    for (const expense of expenses) {
      addByKey(
        formatDateOnly(expense.spentOn),
        "expenses",
        toNumber(expense.amount)
      )
    }
    for (const fee of fees) {
      addByKey(
        toTehranDateOnly(fee.chargedAt),
        "expenses",
        toNumber(fee.amount)
      )
    }

    return buckets.map(({ label, revenue, expenses }) => ({
      label,
      revenue,
      expenses,
    }))
  }

  // 4) 6 months or Annual -> monthly buckets
  const monthCount = window.period === "6m" ? 6 : 12
  const monthKeys: string[] = []
  const byMonth = new Map<string, { revenue: number; expenses: number }>()

  const endYear = window.currentToDate.getUTCFullYear()
  const endMonth = window.currentToDate.getUTCMonth()

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const d = new Date(Date.UTC(endYear, endMonth - offset, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    monthKeys.push(key)
    byMonth.set(key, { revenue: 0, expenses: 0 })
  }

  for (const payment of payments) {
    const key = toTehranDateOnly(
      payment.completedAt ?? payment.createdAt
    ).slice(0, 7)
    const bucket = byMonth.get(key)
    if (bucket) {
      bucket.revenue += toNumber(payment.amount)
    }
  }

  for (const income of incomes) {
    const key = formatDateOnly(income.receivedOn).slice(0, 7)
    const bucket = byMonth.get(key)
    if (bucket) {
      bucket.revenue += toNumber(income.amount)
    }
  }

  for (const expense of expenses) {
    const key = formatDateOnly(expense.spentOn).slice(0, 7)
    const bucket = byMonth.get(key)
    if (bucket) {
      bucket.expenses += toNumber(expense.amount)
    }
  }

  for (const fee of fees) {
    const key = toTehranDateOnly(fee.chargedAt).slice(0, 7)
    const bucket = byMonth.get(key)
    if (bucket) {
      bucket.expenses += toNumber(fee.amount)
    }
  }

  return monthKeys.map((key) => {
    const bucket = byMonth.get(key) ?? { revenue: 0, expenses: 0 }
    return {
      label:
        monthCount <= 6
          ? formatMonthLabel(key).slice(0, 3)
          : formatMonthShortLabel(key),
      revenue: bucket.revenue,
      expenses: bucket.expenses,
    }
  })
}

export async function getDashboardDataForAdmin(
  period: DashboardPeriod = "monthly"
): Promise<DashboardData> {
  await settleDueInstallments()
  const db = getDb()

  const window = resolvePeriodWindow(period)

  const [
    providerAccountRows,
    businessAccountRows,
    periodPayments,
    connectedServices,
    currentCompletedPayments,
    prevCompletedPayments,
    currentIncome,
    prevIncome,
    currentPaidExpenses,
    prevPaidExpenses,
    currentSettledFees,
    prevSettledFees,
    cashflowPayments,
    cashflowIncomes,
    cashflowExpenses,
    cashflowFees,
    pendingPaymentsByAccount,
    pendingExpensesByAccount,
    unassignedPendingExpenses,
    failedPaymentsInPeriod,
    failedWebhookDeliveries,
    dueRecurringExpenses,
  ] = await Promise.all([
    db.financialAccount.findMany({
      where: { kind: "PROVIDER", isActive: true },
      orderBy: [{ environment: "desc" }, { name: "asc" }],
      include: {
        provider: { select: { name: true } },
        reconciliations: {
          orderBy: { asOf: "desc" },
          take: 1,
        },
      },
    }),
    db.financialAccount.findMany({
      where: { kind: "BUSINESS", isActive: true },
      orderBy: { name: "asc" },
      include: {
        reconciliations: {
          orderBy: { asOf: "desc" },
          take: 1,
        },
      },
    }),
    db.payment.findMany({
      where: {
        createdAt: {
          gte: window.currentStartInstant,
          lt: window.currentEndInstant,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        service: { select: { name: true } },
        provider: { select: { name: true } },
      },
    }),
    db.connectedService.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    db.payment.aggregate({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: window.currentStartInstant,
          lt: window.currentEndInstant,
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.payment.aggregate({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: window.prevStartInstant,
          lt: window.prevEndInstant,
        },
      },
      _sum: { amount: true },
    }),
    db.income.aggregate({
      where: {
        receivedOn: {
          gte: window.currentFromDate,
          lte: window.currentToDate,
        },
      },
      _sum: { amount: true },
    }),
    db.income.aggregate({
      where: {
        receivedOn: {
          gte: window.prevFromDate,
          lte: window.prevToDate,
        },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        status: { not: "VOIDED" },
        spentOn: {
          gte: window.currentFromDate,
          lte: window.currentToDate,
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.expense.aggregate({
      where: {
        status: { not: "VOIDED" },
        spentOn: {
          gte: window.prevFromDate,
          lte: window.prevToDate,
        },
      },
      _sum: { amount: true },
    }),
    db.providerFee.aggregate({
      where: {
        status: "SETTLED",
        chargedAt: {
          gte: window.currentStartInstant,
          lt: window.currentEndInstant,
        },
      },
      _sum: { amount: true },
    }),
    db.providerFee.aggregate({
      where: {
        status: "SETTLED",
        chargedAt: {
          gte: window.prevStartInstant,
          lt: window.prevEndInstant,
        },
      },
      _sum: { amount: true },
    }),
    db.payment.findMany({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: window.currentStartInstant,
          lt: window.currentEndInstant,
        },
      },
      select: { amount: true, completedAt: true, createdAt: true },
    }),
    db.income.findMany({
      where: {
        receivedOn: {
          gte: window.currentFromDate,
          lte: window.currentToDate,
        },
      },
      select: { amount: true, receivedOn: true },
    }),
    db.expense.findMany({
      where: {
        status: { not: "VOIDED" },
        spentOn: {
          gte: window.currentFromDate,
          lte: window.currentToDate,
        },
      },
      select: { amount: true, spentOn: true },
    }),
    db.providerFee.findMany({
      where: {
        status: "SETTLED",
        chargedAt: {
          gte: window.currentStartInstant,
          lt: window.currentEndInstant,
        },
      },
      select: { amount: true, chargedAt: true },
    }),
    db.payment.groupBy({
      by: ["providerAccountId"],
      where: {
        status: "PENDING",
        providerAccountId: { not: null },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.expense.groupBy({
      by: ["accountId"],
      where: {
        status: "PENDING",
        accountId: { not: null },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.payment.count({
      where: {
        status: "FAILED",
        createdAt: {
          gte: window.currentStartInstant,
          lt: window.currentEndInstant,
        },
      },
    }),
    db.webhookDelivery.count({
      where: {
        status: { in: ["FAILED", "EXHAUSTED"] },
      },
    }),
    db.recurringExpense.count({
      where: {
        status: "ACTIVE",
        nextDueOn: { lte: window.currentToDate },
      },
    }),
  ])

  const pendingPaymentAmountByAccount = new Map<string, number>()
  let totalPendingPaymentCount = 0
  for (const row of pendingPaymentsByAccount) {
    if (row.providerAccountId) {
      pendingPaymentAmountByAccount.set(
        row.providerAccountId,
        toNumber(row._sum.amount)
      )
      totalPendingPaymentCount += row._count._all
    }
  }

  const pendingExpenseAmountByAccount = new Map<string, number>()
  for (const row of pendingExpensesByAccount) {
    if (row.accountId) {
      pendingExpenseAmountByAccount.set(
        row.accountId,
        toNumber(row._sum.amount)
      )
    }
  }

  const providerBalances = await Promise.all(
    providerAccountRows.map((account) => calculateProviderBalance(account.id))
  )
  const providerBalanceMap = new Map(
    providerBalances.map((balance) => [balance.account.id, balance])
  )

  const [unassignedIncomeAgg, unassignedExpenseAgg] = await Promise.all([
    db.income.aggregate({
      where: { accountId: null },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { accountId: null, status: { not: "VOIDED" } },
      _sum: { amount: true },
    }),
  ])
  const unassignedNetDecimal = (
    unassignedIncomeAgg._sum.amount ?? new Prisma.Decimal(0)
  ).minus(unassignedExpenseAgg._sum.amount ?? new Prisma.Decimal(0))

  const businessAccountsCalculated = await Promise.all(
    businessAccountRows.map(async (account, index) => {
      const [
        incomes,
        contributions,
        transfersIn,
        paidExpenses,
        payouts,
        transfersOut,
      ] = await Promise.all([
        db.income.aggregate({
          where: { accountId: account.id, currency: account.currency },
          _sum: { amount: true },
        }),
        db.capitalContribution.aggregate({
          where: { accountId: account.id, currency: account.currency },
          _sum: { amount: true },
        }),
        db.transfer.aggregate({
          where: {
            toAccountId: account.id,
            status: "COMPLETED",
            currency: account.currency,
          },
          _sum: { amount: true },
        }),
        db.expense.aggregate({
          where: {
            accountId: account.id,
            status: { not: "VOIDED" },
            currency: account.currency,
          },
          _sum: { amount: true },
        }),
        db.shareholderPayout.aggregate({
          where: {
            accountId: account.id,
            status: "COMPLETED",
            currency: account.currency,
          },
          _sum: { amount: true },
        }),
        db.transfer.aggregate({
          where: {
            fromAccountId: account.id,
            status: "COMPLETED",
            currency: account.currency,
          },
          _sum: { amount: true },
        }),
      ])

      const zero = new Prisma.Decimal(0)
      const calculated = account.openingBalance
        .plus(incomes._sum.amount ?? zero)
        .plus(contributions._sum.amount ?? zero)
        .plus(transfersIn._sum.amount ?? zero)
        .minus(paidExpenses._sum.amount ?? zero)
        .minus(payouts._sum.amount ?? zero)
        .minus(transfersOut._sum.amount ?? zero)
        .plus(index === 0 ? unassignedNetDecimal : zero)

      return { accountId: account.id, calculated }
    })
  )
  const businessBalanceMap = new Map(
    businessAccountsCalculated.map((row) => [row.accountId, row.calculated])
  )

  const unassignedNetNumber =
    businessAccountRows.length === 0 ? toNumber(unassignedNetDecimal) : 0

  const accounts: DashboardAccount[] = [
    ...providerAccountRows.map((account) => {
      const balance = providerBalanceMap.get(account.id)
      const calculatedBalance = toNumber(balance?.calculatedBalance)
      const latestRec = account.reconciliations[0]
      const actualBalance = latestRec
        ? toNumber(latestRec.actualBalance)
        : calculatedBalance
      const pendingPayments = pendingPaymentAmountByAccount.get(account.id) ?? 0
      const pendingFees = toNumber(balance?.pendingFees)

      return {
        id: account.id,
        name: account.name,
        kind: "Provider account" as const,
        environment:
          account.environment === "LIVE"
            ? ("Live" as const)
            : ("Simulator" as const),
        actualBalance,
        calculatedBalance,
        pendingAmount: pendingPayments + pendingFees,
        reconciledAt: latestRec ? formatDateOnly(latestRec.asOf) : null,
      }
    }),
    ...businessAccountRows.map((account) => {
      const calculatedDecimal = businessBalanceMap.get(account.id)
      const calculatedBalance = toNumber(calculatedDecimal)
      const latestRec = account.reconciliations[0]
      const actualBalance = latestRec
        ? toNumber(latestRec.actualBalance)
        : calculatedBalance
      const pendingExpenses = pendingExpenseAmountByAccount.get(account.id) ?? 0

      return {
        id: account.id,
        name: account.name,
        kind: "Business account" as const,
        environment: "Bank" as const,
        actualBalance,
        calculatedBalance,
        pendingAmount: pendingExpenses,
        reconciledAt: latestRec ? formatDateOnly(latestRec.asOf) : null,
      }
    }),
    ...(businessAccountRows.length === 0 && unassignedNetNumber !== 0
      ? [
          {
            id: "unassigned-business-ledger",
            name: "General Business Balance",
            kind: "Business account" as const,
            environment: "Bank" as const,
            actualBalance: unassignedNetNumber,
            calculatedBalance: unassignedNetNumber,
            pendingAmount: 0,
            reconciledAt: null,
          },
        ]
      : []),
  ]

  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.calculatedBalance,
    0
  )
  const installmentReceivable = providerBalances.reduce(
    (sum, balance) => sum + toNumber(balance.unreceivedInstallments),
    0
  )
  const allCashBalance = totalBalance + installmentReceivable

  const currentRevenue =
    toNumber(currentCompletedPayments._sum.amount) +
    toNumber(currentIncome._sum.amount)
  const prevRevenue =
    toNumber(prevCompletedPayments._sum.amount) +
    toNumber(prevIncome._sum.amount)

  const currentExpenses =
    toNumber(currentPaidExpenses._sum.amount) +
    toNumber(currentSettledFees._sum.amount)
  const prevExpenses =
    toNumber(prevPaidExpenses._sum.amount) +
    toNumber(prevSettledFees._sum.amount)

  const currentNetProfit = currentRevenue - currentExpenses
  const prevNetProfit = prevRevenue - prevExpenses

  const revenueChange = formatPercentageChange(currentRevenue, prevRevenue)
  const expensesChange = formatPercentageChange(
    currentExpenses,
    prevExpenses,
    true
  )
  const profitChange = formatPercentageChange(currentNetProfit, prevNetProfit)

  const cashflow = buildCashflowPoints(
    window,
    cashflowPayments,
    cashflowIncomes,
    cashflowExpenses,
    cashflowFees
  )

  const alerts: DashboardAlert[] = []
  for (const service of await getReportingHealth()) {
    if (service.status === "stale") {
      alerts.push({
        id: `alert-service-stale-${service.domain}`,
        title: `${service.service} has payments stuck pending`,
        description: `${service.stalePending} payment${service.stalePending === 1 ? " has" : "s have"} been pending for over two hours. The service's @obhco/pay reconcile job is probably not running, so verified payments may be missing from OBH.`,
        severity: "warning",
      })
    }
  }

  for (const account of accounts) {
    const diff = account.actualBalance - account.calculatedBalance
    if (diff !== 0) {
      alerts.push({
        id: `alert-reconciliation-${account.id}`,
        title: `Reconciliation difference on ${account.name}`,
        description: `Latest reconciled balance differs from calculated movements by ${Math.abs(diff).toLocaleString("en-US")} R.`,
        severity: "warning",
      })
    }
  }

  if (totalPendingPaymentCount > 0) {
    alerts.push({
      id: "alert-pending-payments",
      title: "Payments awaiting verification",
      description: `${totalPendingPaymentCount} payment${totalPendingPaymentCount === 1 ? " is" : "s are"} currently pending and awaiting customer completion or Sadad verification.`,
      severity: "info",
    })
  }

  if (failedPaymentsInPeriod > 0) {
    alerts.push({
      id: "alert-failed-payments",
      title: `Failed payment attempts (${window.cashflowBadgeLabel.toLowerCase()})`,
      description: `${failedPaymentsInPeriod} payment${failedPaymentsInPeriod === 1 ? " attempt" : " attempts"} failed during gateway request or verification in the selected period.`,
      severity: "warning",
    })
  }

  const pendingExpenseCount = unassignedPendingExpenses._count._all
  if (pendingExpenseCount > 0) {
    const pendingExpenseTotal = toNumber(unassignedPendingExpenses._sum.amount)
    alerts.push({
      id: "alert-pending-expenses",
      title: "Expenses awaiting settlement",
      description: `${pendingExpenseCount} pending expense${pendingExpenseCount === 1 ? "" : "s"} totaling ${pendingExpenseTotal.toLocaleString("en-US")} R require payment confirmation.`,
      severity: "info",
    })
  }

  if (dueRecurringExpenses > 0) {
    alerts.push({
      id: "alert-due-recurring",
      title: "Recurring expenses due",
      description: `${dueRecurringExpenses} active recurring expense rule${dueRecurringExpenses === 1 ? " is" : "s are"} due to be generated.`,
      severity: "warning",
    })
  }

  if (failedWebhookDeliveries > 0) {
    alerts.push({
      id: "alert-failed-webhooks",
      title: "Webhook delivery failures",
      description: `${failedWebhookDeliveries} service webhook notification${failedWebhookDeliveries === 1 ? " has" : "s have"} failed or exhausted retries.`,
      severity: "warning",
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "alert-all-clear",
      title: "All financial records in sync",
      description:
        "No pending reconciliations, overdue expenses, or failed webhook deliveries require attention.",
      severity: "info",
    })
  }

  const transactions: DashboardTransaction[] = periodPayments.map(
    (payment) => ({
      id: payment.id,
      reference: payment.reference,
      gatewayOrderId: String(payment.gatewayOrderId),
      service: payment.service?.name ?? "Unassigned",
      description: payment.description,
      provider: payment.provider?.name ?? "Unknown gateway",
      environment: payment.environment,
      amount: toNumber(payment.amount),
      currency: payment.currency,
      status: mapPaymentStatus(payment.status),
      occurredAt: (payment.completedAt ?? payment.createdAt).toISOString(),
      externalOrderId: payment.externalOrderId ?? "—",
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      traceNumber: payment.traceNumber,
      providerReference: payment.providerReference,
      maskedCardNumber: payment.maskedCardNumber,
      gatewayResultText: payment.gatewayResultText,
    })
  )

  const serviceNameSet = new Set<string>(
    connectedServices.map((service) => service.name)
  )
  for (const tx of transactions) {
    if (tx.service && tx.service !== "Unassigned") {
      serviceNameSet.add(tx.service)
    }
  }

  return {
    period: window.period,
    summary: {
      totalBalance,
      allCashBalance,
      installmentReceivable,
      revenue: currentRevenue,
      expenses: currentExpenses,
      netProfit: currentNetProfit,
      periodLabel: window.periodLabel,
      comparisonHint: window.comparisonHint,
      accountCount: accounts.length,
      completedPaymentCount: currentCompletedPayments._count._all,
      paidExpenseCount: currentPaidExpenses._count._all,
      revenueChangeLabel: revenueChange.label,
      revenueChangeTone: revenueChange.tone,
      expensesChangeLabel: expensesChange.label,
      expensesChangeTone: expensesChange.tone,
      profitChangeLabel: profitChange.label,
      profitChangeTone: profitChange.tone,
    },
    cashflowRangeLabel: window.cashflowRangeLabel,
    cashflowBadgeLabel: window.cashflowBadgeLabel,
    cashflow,
    accounts,
    transactions,
    services: [...serviceNameSet].sort((a, b) => a.localeCompare(b)),
    alerts,
  }
}

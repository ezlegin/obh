import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import {
  addDays,
  currentMonthValue,
  formatDateOnly,
  formatMonthLabel,
  monthRange,
  parseDateOnly,
  todayDateOnlyInTehran,
} from "@/server/accounting/dates"
import { ensureSadadGateway } from "@/server/gateways/gateway-service"
import {
  getSadadConfigStatus,
  SADAD_PROVIDER_NAME,
} from "@/server/payments/providers/sadad"
import { calculateProviderBalance } from "@/server/reconciliation/service"

export type DashboardTransactionStatus =
  | "completed"
  | "pending"
  | "failed"
  | "cancelled"
  | "expired"

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
  summary: {
    totalBalance: number
    revenue: number
    expenses: number
    netProfit: number
    periodLabel: string
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
  cashflow: DashboardCashflowPoint[]
  accounts: DashboardAccount[]
  transactions: DashboardTransaction[]
  services: string[]
  alerts: DashboardAlert[]
}

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

function toTehranDateOnly(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(instant)
}

function previousMonthValue(monthValue: string): string {
  const [yearPart, monthPart] = monthValue.split("-")
  const year = Number(yearPart)
  const month = Number(monthPart)
  if (month === 1) {
    return `${year - 1}-12`
  }
  return `${year}-${String(month - 1).padStart(2, "0")}`
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
      label: current > 0 ? "New this month" : "—",
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

export async function getDashboardDataForAdmin(): Promise<DashboardData> {
  await ensureSadadGateway()
  const db = getDb()

  const currentMonth = currentMonthValue()
  const prevMonth = previousMonthValue(currentMonth)
  const currentRange = monthRange(currentMonth)
  const prevRange = monthRange(prevMonth)

  const currentFromDate = parseDateOnly(currentRange.startsOn)
  const currentToDate = parseDateOnly(currentRange.endsOn)
  const prevFromDate = parseDateOnly(prevRange.startsOn)
  const prevToDate = parseDateOnly(prevRange.endsOn)

  const todayStr = todayDateOnlyInTehran()
  const todayDate = parseDateOnly(todayStr)
  const sevenDaysAgoDate = addDays(todayDate, -6)
  const sevenDaysAgoStr = formatDateOnly(sevenDaysAgoDate)
  const cashflowStartInstant = new Date(`${sevenDaysAgoStr}T00:00:00+03:30`)

  const [
    providerAccountRows,
    businessAccountRows,
    recentPayments,
    connectedServices,
    currentMonthCompletedPayments,
    prevMonthCompletedPayments,
    currentMonthIncome,
    prevMonthIncome,
    currentMonthPaidExpenses,
    prevMonthPaidExpenses,
    currentMonthSettledFees,
    prevMonthSettledFees,
    cashflowPayments,
    cashflowIncomes,
    cashflowExpenses,
    cashflowFees,
    pendingPaymentsByAccount,
    pendingExpensesByAccount,
    unassignedPendingExpenses,
    failedPaymentsLast7Days,
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
          gte: currentRange.startInstant,
          lt: currentRange.endInstant,
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.payment.aggregate({
      where: {
        status: "COMPLETED",
        completedAt: {
          gte: prevRange.startInstant,
          lt: prevRange.endInstant,
        },
      },
      _sum: { amount: true },
    }),
    db.income.aggregate({
      where: {
        receivedOn: { gte: currentFromDate, lte: currentToDate },
      },
      _sum: { amount: true },
    }),
    db.income.aggregate({
      where: {
        receivedOn: { gte: prevFromDate, lte: prevToDate },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        status: "PAID",
        spentOn: { gte: currentFromDate, lte: currentToDate },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.expense.aggregate({
      where: {
        status: "PAID",
        spentOn: { gte: prevFromDate, lte: prevToDate },
      },
      _sum: { amount: true },
    }),
    db.providerFee.aggregate({
      where: {
        status: "SETTLED",
        chargedAt: {
          gte: currentRange.startInstant,
          lt: currentRange.endInstant,
        },
      },
      _sum: { amount: true },
    }),
    db.providerFee.aggregate({
      where: {
        status: "SETTLED",
        chargedAt: {
          gte: prevRange.startInstant,
          lt: prevRange.endInstant,
        },
      },
      _sum: { amount: true },
    }),
    db.payment.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: cashflowStartInstant },
      },
      select: { amount: true, completedAt: true, createdAt: true },
    }),
    db.income.findMany({
      where: {
        receivedOn: { gte: sevenDaysAgoDate, lte: todayDate },
      },
      select: { amount: true, receivedOn: true },
    }),
    db.expense.findMany({
      where: {
        status: "PAID",
        spentOn: { gte: sevenDaysAgoDate, lte: todayDate },
      },
      select: { amount: true, spentOn: true },
    }),
    db.providerFee.findMany({
      where: {
        status: "SETTLED",
        chargedAt: { gte: cashflowStartInstant },
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
        createdAt: { gte: cashflowStartInstant },
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
        nextDueOn: { lte: todayDate },
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

  const businessAccountsCalculated = await Promise.all(
    businessAccountRows.map(async (account) => {
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
            status: "PAID",
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

      return { accountId: account.id, calculated }
    })
  )
  const businessBalanceMap = new Map(
    businessAccountsCalculated.map((row) => [row.accountId, row.calculated])
  )

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
        reconciledAt: latestRec
          ? formatDateOnly(latestRec.asOf)
          : null,
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
        reconciledAt: latestRec
          ? formatDateOnly(latestRec.asOf)
          : null,
      }
    }),
  ]

  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.calculatedBalance,
    0
  )

  const currentRevenue =
    toNumber(currentMonthCompletedPayments._sum.amount) +
    toNumber(currentMonthIncome._sum.amount)
  const prevRevenue =
    toNumber(prevMonthCompletedPayments._sum.amount) +
    toNumber(prevMonthIncome._sum.amount)

  const currentExpenses =
    toNumber(currentMonthPaidExpenses._sum.amount) +
    toNumber(currentMonthSettledFees._sum.amount)
  const prevExpenses =
    toNumber(prevMonthPaidExpenses._sum.amount) +
    toNumber(prevMonthSettledFees._sum.amount)

  const currentNetProfit = currentRevenue - currentExpenses
  const prevNetProfit = prevRevenue - prevExpenses

  const revenueChange = formatPercentageChange(currentRevenue, prevRevenue)
  const expensesChange = formatPercentageChange(
    currentExpenses,
    prevExpenses,
    true
  )
  const profitChange = formatPercentageChange(currentNetProfit, prevNetProfit)

  // Build 7-day daily cashflow buckets
  const cashflowByDate = new Map<string, { revenue: number; expenses: number }>()
  const dateKeys: string[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayDate = addDays(todayDate, -offset)
    const key = formatDateOnly(dayDate)
    dateKeys.push(key)
    cashflowByDate.set(key, { revenue: 0, expenses: 0 })
  }

  for (const payment of cashflowPayments) {
    const key = toTehranDateOnly(payment.completedAt ?? payment.createdAt)
    const bucket = cashflowByDate.get(key)
    if (bucket) {
      bucket.revenue += toNumber(payment.amount)
    }
  }

  for (const income of cashflowIncomes) {
    const key = formatDateOnly(income.receivedOn)
    const bucket = cashflowByDate.get(key)
    if (bucket) {
      bucket.revenue += toNumber(income.amount)
    }
  }

  for (const expense of cashflowExpenses) {
    const key = formatDateOnly(expense.spentOn)
    const bucket = cashflowByDate.get(key)
    if (bucket) {
      bucket.expenses += toNumber(expense.amount)
    }
  }

  for (const fee of cashflowFees) {
    const key = toTehranDateOnly(fee.chargedAt)
    const bucket = cashflowByDate.get(key)
    if (bucket) {
      bucket.expenses += toNumber(fee.amount)
    }
  }

  const cashflow: DashboardCashflowPoint[] = dateKeys.map((key) => {
    const bucket = cashflowByDate.get(key) ?? { revenue: 0, expenses: 0 }
    return {
      label: formatDayShortLabel(key),
      revenue: bucket.revenue,
      expenses: bucket.expenses,
    }
  })

  const cashflowRangeLabel = `${formatDayShortLabel(dateKeys[0] ?? todayStr)} – ${formatDayShortLabel(dateKeys[dateKeys.length - 1] ?? todayStr)}`

  // Build actionable alerts from real database state
  const alerts: DashboardAlert[] = []
  const sadadConfig = getSadadConfigStatus()

  if (!sadadConfig.liveConfigured) {
    alerts.push({
      id: "alert-sadad-credentials",
      title: "Sadad live credentials not configured",
      description:
        "Live Sadad environment variables (SADAD_MERCHANT_ID, SADAD_TERMINAL_ID, SADAD_TERMINAL_KEY) are missing. Simulator payments work normally.",
      severity: "warning",
    })
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

  if (failedPaymentsLast7Days > 0) {
    alerts.push({
      id: "alert-failed-payments",
      title: "Failed payment attempts (last 7 days)",
      description: `${failedPaymentsLast7Days} payment${failedPaymentsLast7Days === 1 ? " attempt" : " attempts"} failed during gateway request or verification in the past 7 days.`,
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

  const transactions: DashboardTransaction[] = recentPayments.map((payment) => ({
    id: payment.id,
    reference: payment.reference,
    gatewayOrderId: String(payment.gatewayOrderId),
    service: payment.service?.name ?? "Unassigned",
    description: payment.description,
    provider: payment.provider?.name ?? SADAD_PROVIDER_NAME,
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
  }))

  const serviceNameSet = new Set<string>(
    connectedServices.map((service) => service.name)
  )
  for (const tx of transactions) {
    if (tx.service && tx.service !== "Unassigned") {
      serviceNameSet.add(tx.service)
    }
  }

  return {
    summary: {
      totalBalance,
      revenue: currentRevenue,
      expenses: currentExpenses,
      netProfit: currentNetProfit,
      periodLabel: formatMonthLabel(currentMonth),
      accountCount: accounts.length,
      completedPaymentCount: currentMonthCompletedPayments._count._all,
      paidExpenseCount: currentMonthPaidExpenses._count._all,
      revenueChangeLabel: revenueChange.label,
      revenueChangeTone: revenueChange.tone,
      expensesChangeLabel: expensesChange.label,
      expensesChangeTone: expensesChange.tone,
      profitChangeLabel: profitChange.label,
      profitChangeTone: profitChange.tone,
    },
    cashflowRangeLabel,
    cashflow,
    accounts,
    transactions,
    services: [...serviceNameSet].sort((a, b) => a.localeCompare(b)),
    alerts,
  }
}

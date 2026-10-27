import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { formatDateOnly, todayDateOnly } from "@/server/accounting/dates"
import { getEffectiveServiceOwnership } from "@/server/services/service-ownership"

export type ServiceWorkspacePeriod = {
  id: string
  startsOn: string
  endsOn: string
  grossPayments: string
  manualIncome: string
  totalExpenses: string
  providerFees: string
  netProfit: string
  distributableAmount: string
  unallocatedResidual: string
  ownershipSource: "SERVICE" | "CORPORATE"
  ownershipTotal: string
  calculatedAt: string
  distributions: Array<{
    id: string
    shareholderId: string
    shareholderName: string
    percentage: string
    allocatedAmount: string
    currency: string
  }>
}

export type ServiceWorkspace = {
  service: {
    id: string
    name: string
    slug: string
    domain: string
    description: string | null
    isActive: boolean
    createdAt: string
  }
  shareholders: Array<{ id: string; name: string; isActive: boolean }>
  ownership: {
    source: "SERVICE" | "CORPORATE"
    entries: Array<{
      shareholderId: string
      shareholderName: string
      percentage: string
    }>
  }
  stats: {
    grossPayments: string
    income: string
    expenses: string
    providerFees: string
    balance: string
    paymentCount: number
    incomeCount: number
    expenseCount: number
  }
  payments: Array<{
    id: string
    reference: string
    amount: string
    currency: string
    status: string
    environment: string
    completedAt: string | null
    createdAt: string
  }>
  incomes: Array<{
    id: string
    amount: string
    currency: string
    receivedOn: string
    description: string
    source: string | null
  }>
  expenses: Array<{
    id: string
    amount: string
    currency: string
    spentOn: string
    description: string
    categoryName: string
    status: string
  }>
  periods: ServiceWorkspacePeriod[]
  currentMonth: string
}

const zero = new Prisma.Decimal(0)

export async function getServiceWorkspace(
  serviceId: string
): Promise<ServiceWorkspace | null> {
  const db = getDb()
  const service = await db.connectedService.findUnique({
    where: { id: serviceId },
  })

  if (!service) {
    return null
  }

  const today = parseToday()

  const [
    grossPaymentsAgg,
    incomeAgg,
    expenseAgg,
    feeAgg,
    paymentCount,
    incomeCount,
    expenseCount,
    ownership,
    shareholders,
    payments,
    incomes,
    expenses,
    periodRows,
  ] = await Promise.all([
    db.payment.aggregate({
      where: {
        serviceId: service.id,
        status: "COMPLETED",
        environment: "LIVE",
        currency: "IRR",
      },
      _sum: { amount: true },
    }),
    db.income.aggregate({
      where: { serviceId: service.id, currency: "IRR" },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        serviceId: service.id,
        status: "PAID",
        currency: "IRR",
      },
      _sum: { amount: true },
    }),
    db.providerFee.aggregate({
      where: {
        status: "SETTLED",
        currency: "IRR",
        providerAccount: { environment: "LIVE" },
        payment: { serviceId: service.id, environment: "LIVE" },
      },
      _sum: { amount: true },
    }),
    db.payment.count({ where: { serviceId: service.id } }),
    db.income.count({ where: { serviceId: service.id } }),
    db.expense.count({ where: { serviceId: service.id } }),
    getEffectiveServiceOwnership(service.id, today),
    db.shareholder.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
    db.payment.findMany({
      where: { serviceId: service.id },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        reference: true,
        amount: true,
        currency: true,
        status: true,
        environment: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    db.income.findMany({
      where: { serviceId: service.id },
      orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        amount: true,
        currency: true,
        receivedOn: true,
        description: true,
        source: true,
      },
    }),
    db.expense.findMany({
      where: { serviceId: service.id },
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        amount: true,
        currency: true,
        spentOn: true,
        description: true,
        status: true,
        category: { select: { name: true } },
      },
    }),
    db.serviceProfitPeriod.findMany({
      where: { serviceId: service.id },
      orderBy: [{ endsOn: "desc" }],
      take: 12,
      include: {
        distributions: {
          include: { shareholder: { select: { id: true, name: true } } },
          orderBy: { allocatedAmount: "desc" },
        },
      },
    }),
  ])

  const grossPayments = grossPaymentsAgg._sum.amount ?? zero
  const income = incomeAgg._sum.amount ?? zero
  const expensesTotal = expenseAgg._sum.amount ?? zero
  const providerFees = feeAgg._sum.amount ?? zero
  const balance = grossPayments
    .plus(income)
    .minus(expensesTotal)
    .minus(providerFees)

  return {
    service: {
      id: service.id,
      name: service.name,
      slug: service.slug,
      domain: service.domain,
      description: service.description,
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
    },
    shareholders,
    ownership: {
      source: ownership.source,
      entries: ownership.entries.map((entry) => ({
        shareholderId: entry.shareholderId,
        shareholderName: entry.shareholderName,
        percentage: entry.percentage.toFixed(4),
      })),
    },
    stats: {
      grossPayments: grossPayments.toFixed(2),
      income: income.toFixed(2),
      expenses: expensesTotal.toFixed(2),
      providerFees: providerFees.toFixed(2),
      balance: balance.toFixed(2),
      paymentCount,
      incomeCount,
      expenseCount,
    },
    payments: payments.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      status: payment.status,
      environment: payment.environment,
      completedAt: payment.completedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
    incomes: incomes.map((item) => ({
      id: item.id,
      amount: item.amount.toFixed(2),
      currency: item.currency,
      receivedOn: formatDateOnly(item.receivedOn),
      description: item.description,
      source: item.source,
    })),
    expenses: expenses.map((item) => ({
      id: item.id,
      amount: item.amount.toFixed(2),
      currency: item.currency,
      spentOn: formatDateOnly(item.spentOn),
      description: item.description,
      categoryName: item.category.name,
      status: item.status,
    })),
    periods: periodRows.map((period) => ({
      id: period.id,
      startsOn: formatDateOnly(period.startsOn),
      endsOn: formatDateOnly(period.endsOn),
      grossPayments: period.grossPayments.toFixed(2),
      manualIncome: period.manualIncome.toFixed(2),
      totalExpenses: period.totalExpenses.toFixed(2),
      providerFees: period.providerFees.toFixed(2),
      netProfit: period.netProfit.toFixed(2),
      distributableAmount: period.distributableAmount.toFixed(2),
      unallocatedResidual: period.unallocatedResidual.toFixed(2),
      ownershipSource: period.ownershipSource as "SERVICE" | "CORPORATE",
      ownershipTotal: period.ownershipTotal.toFixed(4),
      calculatedAt: period.calculatedAt.toISOString(),
      distributions: period.distributions.map((distribution) => ({
        id: distribution.id,
        shareholderId: distribution.shareholderId,
        shareholderName: distribution.shareholder.name,
        percentage: distribution.percentageSnapshot.toFixed(4),
        allocatedAmount: distribution.allocatedAmount.toFixed(2),
        currency: distribution.currency,
      })),
    })),
    currentMonth: todayDateOnly().slice(0, 7),
  }
}

function parseToday() {
  return new Date(`${todayDateOnly()}T00:00:00.000Z`)
}

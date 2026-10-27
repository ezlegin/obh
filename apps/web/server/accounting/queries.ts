import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import {
  formatDateOnly,
  startOfMonthDate,
  startOfNextMonthDate,
  todayDateOnly,
} from "@/server/accounting/dates"
import { calculateProviderBalance } from "@/server/reconciliation/service"

export type AdminBusinessAccount = {
  id: string
  name: string
  institution: string | null
  maskedIdentifier: string | null
  currency: string
  openingBalance: string
  calculatedBalance: string
  openingBalanceAt: string | null
  isActive: boolean
  notes: string | null
  expenseCount: number
  incomeCount: number
  createdAt: string
}

export type AdminExpenseDocument = {
  id: string
  fileName: string
  mimeType: string
  byteSize: number
  createdAt: string
}

export type AdminServiceOption = {
  id: string
  name: string
  domain: string
}

export type AdminExpense = {
  id: string
  categoryId: string
  categoryName: string
  categoryRequiresDocument: boolean
  accountId: string | null
  accountName: string | null
  serviceId: string | null
  serviceName: string | null
  amount: string
  currency: string
  spentOn: string
  description: string
  notes: string | null
  status: "PENDING" | "PAID" | "VOIDED"
  paidAt: string | null
  externalReference: string | null
  createdAt: string
  recurringExpenseId: string | null
  documents: AdminExpenseDocument[]
}

export type AdminExpenseCategory = {
  id: string
  name: string
  description: string | null
  requiresDocument: boolean
  isActive: boolean
  sortOrder: number
  expenseCount: number
  recurringCount: number
}

export type AdminRecurringExpense = {
  id: string
  categoryId: string
  categoryName: string
  accountId: string | null
  accountName: string | null
  serviceId: string | null
  serviceName: string | null
  amount: string
  currency: string
  description: string
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
  intervalCount: number
  startOn: string
  nextDueOn: string
  endOn: string | null
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED"
  approvedAt: string | null
  approvedByName: string | null
  notes: string | null
  expenseCount: number
  isDue: boolean
  createdAt: string
}

export type ExpenseWorkspace = {
  accounts: AdminBusinessAccount[]
  categories: AdminExpenseCategory[]
  services: AdminServiceOption[]
  expenses: AdminExpense[]
  recurringExpenses: AdminRecurringExpense[]
  summary: {
    paidThisMonth: string
    pendingTotal: string
    activeRecurring: number
    documentCount: number
    expenseCount: number
  }
}

export type AdminIncome = {
  id: string
  accountId: string | null
  accountName: string | null
  serviceId: string | null
  serviceName: string | null
  amount: string
  currency: string
  receivedOn: string
  description: string
  source: string | null
  externalReference: string | null
  notes: string | null
  createdAt: string
}

export type IncomeWorkspace = {
  accounts: AdminBusinessAccount[]
  services: AdminServiceOption[]
  incomes: AdminIncome[]
  summary: {
    totalBusinessBalance: string
    /** Installment amounts the gateways still owe the business. */
    installmentReceivable: string
    /** Total business balance if every installment purchase were paid in full. */
    allCashBusinessBalance: string
    completedPaymentsAllTime: string
    receivedThisMonth: string
    receivedAllTime: string
    incomeCount: number
    thisMonthCount: number
  }
}

type BusinessAccountRow = Awaited<
  ReturnType<ReturnType<typeof getDb>["financialAccount"]["findMany"]>
>[number] & {
  _count: { expenses: number; income: number }
}

function mapBusinessAccount(
  account: BusinessAccountRow,
  calculatedBalance: Prisma.Decimal
): AdminBusinessAccount {
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    maskedIdentifier: account.maskedIdentifier,
    currency: account.currency,
    openingBalance: account.openingBalance.toFixed(2),
    calculatedBalance: calculatedBalance.toFixed(2),
    openingBalanceAt: account.openingBalanceAt
      ? formatDateOnly(account.openingBalanceAt)
      : null,
    isActive: account.isActive,
    notes: account.notes,
    expenseCount: account._count.expenses,
    incomeCount: account._count.income,
    createdAt: account.createdAt.toISOString(),
  }
}

async function listServiceOptions(): Promise<AdminServiceOption[]> {
  return getDb().connectedService.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, domain: true },
  })
}

async function listBusinessAccounts(options?: { activeOnly?: boolean }) {
  const db = getDb()
  const [accounts, unassignedIncomeAgg, unassignedExpenseAgg] =
    await Promise.all([
      db.financialAccount.findMany({
        where: {
          kind: "BUSINESS",
          ...(options?.activeOnly ? { isActive: true } : {}),
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        include: {
          _count: {
            select: { expenses: true, income: true },
          },
        },
      }),
      db.income.aggregate({
        where: { accountId: null },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: { accountId: null, status: { not: "VOIDED" } },
        _sum: { amount: true },
      }),
    ])

  const zero = new Prisma.Decimal(0)
  const unassignedNet = (unassignedIncomeAgg._sum.amount ?? zero).minus(
    unassignedExpenseAgg._sum.amount ?? zero
  )

  return Promise.all(
    accounts.map(async (account, index) => {
      const [
        incomes,
        contributions,
        transfersIn,
        expenses,
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

      const calculated = account.openingBalance
        .plus(incomes._sum.amount ?? zero)
        .plus(contributions._sum.amount ?? zero)
        .plus(transfersIn._sum.amount ?? zero)
        .minus(expenses._sum.amount ?? zero)
        .minus(payouts._sum.amount ?? zero)
        .minus(transfersOut._sum.amount ?? zero)
        .plus(index === 0 ? unassignedNet : zero)

      return mapBusinessAccount(account, calculated)
    })
  )
}

export async function getBusinessAccountsForAdmin() {
  return listBusinessAccounts()
}

export async function getExpenseWorkspace(): Promise<ExpenseWorkspace> {
  const db = getDb()
  const monthStart = startOfMonthDate()
  const nextMonthStart = startOfNextMonthDate()
  const today = todayDateOnly()

  const [
    accounts,
    categories,
    services,
    expenseRows,
    recurringRows,
    paidMonth,
    pending,
    documentCount,
  ] = await Promise.all([
    listBusinessAccounts({ activeOnly: true }),
    db.expenseCategory.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { expenses: true, recurringExpenses: true } },
      },
    }),
    listServiceOptions(),
    db.expense.findMany({
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
      take: 250,
      include: {
        category: {
          select: {
            name: true,
            requiresDocument: true,
          },
        },
        account: { select: { name: true } },
        service: { select: { name: true } },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            byteSize: true,
            createdAt: true,
          },
        },
      },
    }),
    db.recurringExpense.findMany({
      orderBy: [{ status: "asc" }, { nextDueOn: "asc" }],
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
        service: { select: { name: true } },
        approvedBy: { select: { name: true } },
        _count: { select: { expenses: true } },
      },
    }),
    db.expense.aggregate({
      where: {
        status: { not: "VOIDED" },
        spentOn: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
    db.expenseDocument.count(),
  ])

  return {
    accounts,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      requiresDocument: category.requiresDocument,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      expenseCount: category._count.expenses,
      recurringCount: category._count.recurringExpenses,
    })),
    services,
    expenses: expenseRows.map((expense) => ({
      id: expense.id,
      categoryId: expense.categoryId,
      categoryName: expense.category.name,
      categoryRequiresDocument: expense.category.requiresDocument,
      accountId: expense.accountId,
      accountName: expense.account?.name ?? null,
      serviceId: expense.serviceId,
      serviceName: expense.service?.name ?? null,
      amount: expense.amount.toFixed(2),
      currency: expense.currency,
      spentOn: formatDateOnly(expense.spentOn),
      description: expense.description,
      notes: expense.notes,
      status: expense.status,
      paidAt: expense.paidAt?.toISOString() ?? null,
      externalReference: expense.externalReference,
      createdAt: expense.createdAt.toISOString(),
      recurringExpenseId: expense.recurringExpenseId,
      documents: expense.documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        mimeType: document.mimeType,
        byteSize: document.byteSize,
        createdAt: document.createdAt.toISOString(),
      })),
    })),
    recurringExpenses: recurringRows.map((rule) => ({
      id: rule.id,
      categoryId: rule.categoryId,
      categoryName: rule.category.name,
      accountId: rule.accountId,
      accountName: rule.account?.name ?? null,
      serviceId: rule.serviceId,
      serviceName: rule.service?.name ?? null,
      amount: rule.amount.toFixed(2),
      currency: rule.currency,
      description: rule.description,
      frequency: rule.frequency,
      intervalCount: rule.intervalCount,
      startOn: formatDateOnly(rule.startOn),
      nextDueOn: formatDateOnly(rule.nextDueOn),
      endOn: rule.endOn ? formatDateOnly(rule.endOn) : null,
      status: rule.status,
      approvedAt: rule.approvedAt?.toISOString() ?? null,
      approvedByName: rule.approvedBy?.name ?? null,
      notes: rule.notes,
      expenseCount: rule._count.expenses,
      isDue: formatDateOnly(rule.nextDueOn) <= today,
      createdAt: rule.createdAt.toISOString(),
    })),
    summary: {
      paidThisMonth: paidMonth._sum.amount?.toFixed(2) ?? "0.00",
      pendingTotal: pending._sum.amount?.toFixed(2) ?? "0.00",
      activeRecurring: recurringRows.filter((rule) => rule.status === "ACTIVE")
        .length,
      documentCount,
      expenseCount: expenseRows.length,
    },
  }
}

export async function getIncomeWorkspace(): Promise<IncomeWorkspace> {
  const db = getDb()
  const monthStart = startOfMonthDate()
  const nextMonthStart = startOfNextMonthDate()

  const [
    accounts,
    providerAccounts,
    services,
    incomes,
    monthTotal,
    allTime,
    monthCount,
    completedPaymentsAgg,
    unassignedExpenseAgg,
  ] = await Promise.all([
    listBusinessAccounts({ activeOnly: true }),
    db.financialAccount.findMany({
      where: { kind: "PROVIDER", isActive: true },
      select: { id: true },
    }),
    listServiceOptions(),
    db.income.findMany({
      orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }],
      take: 250,
      include: {
        account: { select: { name: true } },
        service: { select: { name: true } },
      },
    }),
    db.income.aggregate({
      where: {
        receivedOn: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
    db.income.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.income.count({
      where: {
        receivedOn: { gte: monthStart, lt: nextMonthStart },
      },
    }),
    db.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { accountId: null, status: { not: "VOIDED" } },
      _sum: { amount: true },
    }),
  ])

  const providerBalances = await Promise.all(
    providerAccounts.map((acc) => calculateProviderBalance(acc.id))
  )

  const zero = new Prisma.Decimal(0)
  const providerTotal = providerBalances.reduce(
    (sum, b) => sum.plus(b.calculatedBalance),
    zero
  )
  const businessTotal =
    accounts.length > 0
      ? accounts.reduce(
          (sum, acc) => sum.plus(new Prisma.Decimal(acc.calculatedBalance)),
          zero
        )
      : (allTime._sum.amount ?? zero).minus(
          unassignedExpenseAgg._sum.amount ?? zero
        )

  const totalBusinessBalance = providerTotal.plus(businessTotal)
  const installmentReceivable = providerBalances.reduce(
    (sum, b) => sum.plus(b.unreceivedInstallments),
    zero
  )

  return {
    accounts,
    services,
    incomes: incomes.map((income) => ({
      id: income.id,
      accountId: income.accountId,
      accountName: income.account?.name ?? null,
      serviceId: income.serviceId,
      serviceName: income.service?.name ?? null,
      amount: income.amount.toFixed(2),
      currency: income.currency,
      receivedOn: formatDateOnly(income.receivedOn),
      description: income.description,
      source: income.source,
      externalReference: income.externalReference,
      notes: income.notes,
      createdAt: income.createdAt.toISOString(),
    })),
    summary: {
      totalBusinessBalance: totalBusinessBalance.toFixed(2),
      installmentReceivable: installmentReceivable.toFixed(2),
      allCashBusinessBalance: totalBusinessBalance
        .plus(installmentReceivable)
        .toFixed(2),
      completedPaymentsAllTime:
        completedPaymentsAgg._sum.amount?.toFixed(2) ?? "0.00",
      receivedThisMonth: monthTotal._sum.amount?.toFixed(2) ?? "0.00",
      receivedAllTime: allTime._sum.amount?.toFixed(2) ?? "0.00",
      incomeCount: allTime._count._all,
      thisMonthCount: monthCount,
    },
  }
}

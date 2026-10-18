import "server-only"

import { getDb } from "@/lib/db/client"
import {
  formatDateOnly,
  startOfMonthDate,
  startOfNextMonthDate,
  todayDateOnly,
} from "@/server/accounting/dates"

export type AdminBusinessAccount = {
  id: string
  name: string
  institution: string | null
  maskedIdentifier: string | null
  currency: string
  openingBalance: string
  openingBalanceAt: string | null
  isActive: boolean
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

export type AdminExpense = {
  id: string
  categoryId: string
  categoryName: string
  categoryRequiresDocument: boolean
  accountId: string | null
  accountName: string | null
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
  incomes: AdminIncome[]
  summary: {
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

function mapBusinessAccount(account: BusinessAccountRow): AdminBusinessAccount {
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    maskedIdentifier: account.maskedIdentifier,
    currency: account.currency,
    openingBalance: account.openingBalance.toFixed(2),
    openingBalanceAt: account.openingBalanceAt
      ? formatDateOnly(account.openingBalanceAt)
      : null,
    isActive: account.isActive,
    expenseCount: account._count.expenses,
    incomeCount: account._count.income,
    createdAt: account.createdAt.toISOString(),
  }
}

async function listBusinessAccounts(options?: { activeOnly?: boolean }) {
  const accounts = await getDb().financialAccount.findMany({
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
  })

  return accounts.map(mapBusinessAccount)
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
        approvedBy: { select: { name: true } },
        _count: { select: { expenses: true } },
      },
    }),
    db.expense.aggregate({
      where: {
        status: "PAID",
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
    expenses: expenseRows.map((expense) => ({
      id: expense.id,
      categoryId: expense.categoryId,
      categoryName: expense.category.name,
      categoryRequiresDocument: expense.category.requiresDocument,
      accountId: expense.accountId,
      accountName: expense.account?.name ?? null,
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

  const [accounts, incomes, monthTotal, allTime, monthCount] =
    await Promise.all([
      listBusinessAccounts({ activeOnly: true }),
      db.income.findMany({
        orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }],
        take: 250,
        include: { account: { select: { name: true } } },
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
    ])

  return {
    accounts,
    incomes: incomes.map((income) => ({
      id: income.id,
      accountId: income.accountId,
      accountName: income.account?.name ?? null,
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
      receivedThisMonth: monthTotal._sum.amount?.toFixed(2) ?? "0.00",
      receivedAllTime: allTime._sum.amount?.toFixed(2) ?? "0.00",
      incomeCount: allTime._count._all,
      thisMonthCount: monthCount,
    },
  }
}

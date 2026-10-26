import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type {
  CreateExpenseInput,
  MarkExpensePaidInput,
} from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import { parseDateOnly } from "@/server/accounting/dates"
import { deleteExpenseDocument } from "@/server/accounting/documents"

async function getActiveBusinessAccount(accountId: string) {
  const account = await getDb().financialAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || account.kind !== "BUSINESS" || !account.isActive) {
    throw new DomainError(
      "ACCOUNT_NOT_FOUND",
      "Select an active business payment source."
    )
  }

  return account
}

async function resolveDefaultBusinessAccountId(accountId?: string) {
  if (accountId) {
    const account = await getActiveBusinessAccount(accountId)
    return account.id
  }

  const defaultAccount = await getDb().financialAccount.findFirst({
    where: { kind: "BUSINESS", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  return defaultAccount?.id ?? null
}

export async function createExpense(
  actorId: string,
  values: CreateExpenseInput
) {
  const db = getDb()
  const category = await db.expenseCategory.findUnique({
    where: { id: values.categoryId },
  })

  if (!category?.isActive) {
    throw new DomainError(
      "CATEGORY_NOT_FOUND",
      "Select an active expense category."
    )
  }

  const resolvedAccountId = await resolveDefaultBusinessAccountId(
    values.accountId
  )
  const amount = new Prisma.Decimal(values.amount)
  const now = new Date()

  return db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        categoryId: category.id,
        accountId: resolvedAccountId,
        amount,
        currency: "IRR",
        spentOn: parseDateOnly(values.spentOn),
        description: values.description,
        notes: values.notes || null,
        externalReference: values.externalReference || null,
        status: "PAID",
        paidAt: now,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "expense.created",
        entityType: "Expense",
        entityId: expense.id,
        after: {
          category: category.name,
          amount: amount.toFixed(2),
          status: expense.status,
          spentOn: values.spentOn,
          accountId: resolvedAccountId,
        },
      },
    })

    return expense
  })
}

export async function markExpensePaid(
  actorId: string,
  values: MarkExpensePaidInput
) {
  const db = getDb()
  const expense = await db.expense.findUnique({
    where: { id: values.expenseId },
  })

  if (!expense) {
    throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.")
  }

  if (expense.status === "VOIDED") {
    throw new DomainError("EXPENSE_VOIDED", "This expense is voided.")
  }

  const account = await getActiveBusinessAccount(values.accountId)

  return db.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: "PAID",
        paidAt: expense.paidAt ?? new Date(),
        accountId: account.id,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "expense.marked_paid",
        entityType: "Expense",
        entityId: expense.id,
        before: { status: expense.status },
        after: {
          status: updated.status,
          accountId: account.id,
          paidAt: updated.paidAt?.toISOString(),
        },
      },
    })

    return updated
  })
}

export async function deleteExpense(actorId: string, expenseId: string) {
  const db = getDb()
  const expense = await db.expense.findUnique({
    where: { id: expenseId },
    include: {
      documents: { select: { id: true } },
    },
  })

  if (!expense) {
    throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.")
  }

  for (const doc of expense.documents) {
    await deleteExpenseDocument(actorId, doc.id).catch(() => undefined)
  }

  return db.$transaction(async (tx) => {
    await tx.expenseDocument.deleteMany({ where: { expenseId: expense.id } })
    await tx.expense.delete({ where: { id: expense.id } })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "expense.deleted",
        entityType: "Expense",
        entityId: expense.id,
        before: {
          description: expense.description,
          amount: expense.amount.toFixed(2),
          status: expense.status,
        },
      },
    })
  })
}

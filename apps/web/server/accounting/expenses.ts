import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type {
  CreateExpenseInput,
  MarkExpensePaidInput,
} from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import { parseDateOnly } from "@/server/accounting/dates"

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

  if (values.accountId) {
    await getActiveBusinessAccount(values.accountId)
  }

  const amount = new Prisma.Decimal(values.amount)

  return db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        categoryId: category.id,
        accountId: values.accountId || null,
        amount,
        currency: "IRR",
        spentOn: parseDateOnly(values.spentOn),
        description: values.description,
        notes: values.notes || null,
        externalReference: values.externalReference || null,
        status: "PENDING",
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
    include: {
      category: true,
      _count: { select: { documents: true } },
    },
  })

  if (!expense) {
    throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.")
  }

  if (expense.status === "PAID") {
    throw new DomainError(
      "EXPENSE_ALREADY_PAID",
      "This expense is already marked paid."
    )
  }

  if (expense.status === "VOIDED") {
    throw new DomainError("EXPENSE_VOIDED", "This expense is voided.")
  }

  if (expense.category.requiresDocument && expense._count.documents === 0) {
    throw new DomainError(
      "DOCUMENT_REQUIRED",
      "Attach at least one supporting document before marking this expense paid."
    )
  }

  const account = await getActiveBusinessAccount(values.accountId)

  return db.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
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

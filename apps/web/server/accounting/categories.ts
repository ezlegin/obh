import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CreateExpenseCategoryInput } from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"

export async function createExpenseCategory(
  actorId: string,
  values: CreateExpenseCategoryInput
) {
  const db = getDb()

  try {
    return await db.$transaction(async (tx) => {
      const category = await tx.expenseCategory.create({
        data: {
          name: values.name,
          description: values.description || null,
          requiresDocument: values.requiresDocument,
          sortOrder: values.sortOrder,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId,
          action: "expense_category.created",
          entityType: "ExpenseCategory",
          entityId: category.id,
          after: {
            name: category.name,
            requiresDocument: category.requiresDocument,
          },
        },
      })

      return category
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DomainError(
        "CATEGORY_EXISTS",
        "An expense category with that name already exists."
      )
    }

    throw error
  }
}

export async function setExpenseCategoryActive(
  actorId: string,
  categoryId: string,
  isActive: boolean
) {
  const db = getDb()
  const category = await db.expenseCategory.findUnique({
    where: { id: categoryId },
  })

  if (!category) {
    throw new DomainError(
      "CATEGORY_NOT_FOUND",
      "Expense category was not found."
    )
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.expenseCategory.update({
      where: { id: category.id },
      data: { isActive },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "expense_category.status_changed",
        entityType: "ExpenseCategory",
        entityId: category.id,
        before: { isActive: category.isActive },
        after: { isActive: updated.isActive },
      },
    })

    return updated
  })
}

export async function deleteExpenseCategory(
  actorId: string,
  categoryId: string
) {
  const db = getDb()
  const category = await db.expenseCategory.findUnique({
    where: { id: categoryId },
  })

  if (!category) {
    throw new DomainError(
      "CATEGORY_NOT_FOUND",
      "Expense category was not found."
    )
  }

  return db.$transaction(async (tx) => {
    await tx.expense.deleteMany({ where: { categoryId: category.id } })
    await tx.recurringExpense.deleteMany({ where: { categoryId: category.id } })
    await tx.expenseCategory.delete({ where: { id: category.id } })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "expense_category.deleted",
        entityType: "ExpenseCategory",
        entityId: category.id,
        before: { name: category.name },
      },
    })
  })
}

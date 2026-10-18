import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type {
  CreateRecurringExpenseInput,
  RecurringExpenseActionInput,
} from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import {
  addRecurringPeriod,
  formatDateOnly,
  isDateOnlyDue,
  parseDateOnly,
} from "@/server/accounting/dates"

export async function createRecurringExpense(
  actorId: string,
  values: CreateRecurringExpenseInput
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
    const account = await db.financialAccount.findUnique({
      where: { id: values.accountId },
    })

    if (!account || account.kind !== "BUSINESS" || !account.isActive) {
      throw new DomainError(
        "ACCOUNT_NOT_FOUND",
        "Select an active business payment source."
      )
    }
  }

  const startOn = parseDateOnly(values.startOn)
  const endOn = values.endOn ? parseDateOnly(values.endOn) : null
  const amount = new Prisma.Decimal(values.amount)

  return db.$transaction(async (tx) => {
    const rule = await tx.recurringExpense.create({
      data: {
        categoryId: category.id,
        accountId: values.accountId || null,
        amount,
        currency: "IRR",
        description: values.description,
        frequency: values.frequency,
        intervalCount: values.intervalCount,
        startOn,
        nextDueOn: startOn,
        endOn,
        status: "DRAFT",
        notes: values.notes || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "recurring_expense.created",
        entityType: "RecurringExpense",
        entityId: rule.id,
        after: {
          category: category.name,
          amount: amount.toFixed(2),
          frequency: rule.frequency,
          nextDueOn: formatDateOnly(rule.nextDueOn),
          status: rule.status,
        },
      },
    })

    return rule
  })
}

export async function changeRecurringExpenseStatus(
  actorId: string,
  values: RecurringExpenseActionInput
) {
  const db = getDb()
  const rule = await db.recurringExpense.findUnique({
    where: { id: values.recurringExpenseId },
  })

  if (!rule) {
    throw new DomainError(
      "RECURRING_EXPENSE_NOT_FOUND",
      "Recurring expense was not found."
    )
  }

  const now = new Date()
  let nextStatus = rule.status
  let approvedAt = rule.approvedAt
  let approvedById = rule.approvedById

  switch (values.action) {
    case "approve":
      if (rule.status === "ACTIVE") {
        return rule
      }
      if (rule.status !== "DRAFT") {
        throw new DomainError(
          "RECURRING_STATE_INVALID",
          "Only a draft recurring expense can be approved."
        )
      }
      nextStatus = "ACTIVE"
      approvedAt = now
      approvedById = actorId
      break
    case "pause":
      if (rule.status === "PAUSED") {
        return rule
      }
      if (rule.status !== "ACTIVE") {
        throw new DomainError(
          "RECURRING_STATE_INVALID",
          "Only an active recurring expense can be paused."
        )
      }
      nextStatus = "PAUSED"
      break
    case "resume":
      if (rule.status === "ACTIVE") {
        return rule
      }
      if (rule.status !== "PAUSED" || !rule.approvedAt) {
        throw new DomainError(
          "RECURRING_STATE_INVALID",
          "Only a previously approved paused recurring expense can resume."
        )
      }
      nextStatus = "ACTIVE"
      break
    case "end":
      if (rule.status === "ENDED") {
        return rule
      }
      nextStatus = "ENDED"
      break
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.recurringExpense.update({
      where: { id: rule.id },
      data: {
        status: nextStatus,
        approvedAt,
        approvedById,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: `recurring_expense.${values.action}`,
        entityType: "RecurringExpense",
        entityId: rule.id,
        before: { status: rule.status },
        after: {
          status: updated.status,
          approvedAt: updated.approvedAt?.toISOString() ?? null,
        },
      },
    })

    return updated
  })
}

export async function generateRecurringExpense(
  actorId: string,
  recurringExpenseId: string
) {
  const db = getDb()
  const rule = await db.recurringExpense.findUnique({
    where: { id: recurringExpenseId },
    include: { category: true, account: true },
  })

  if (!rule) {
    throw new DomainError(
      "RECURRING_EXPENSE_NOT_FOUND",
      "Recurring expense was not found."
    )
  }

  if (rule.status !== "ACTIVE") {
    throw new DomainError(
      "RECURRING_NOT_ACTIVE",
      "Only an approved active recurring expense can generate an expense."
    )
  }

  if (!isDateOnlyDue(rule.nextDueOn)) {
    throw new DomainError(
      "RECURRING_NOT_DUE",
      `The next occurrence is due on ${formatDateOnly(rule.nextDueOn)}.`
    )
  }

  if (!rule.category.isActive) {
    throw new DomainError(
      "CATEGORY_NOT_FOUND",
      "The recurring expense category is inactive."
    )
  }

  if (rule.account && !rule.account.isActive) {
    throw new DomainError(
      "ACCOUNT_NOT_FOUND",
      "The recurring expense payment source is inactive."
    )
  }

  const spentOn = rule.nextDueOn
  const existing = await db.expense.findFirst({
    where: { recurringExpenseId: rule.id, spentOn },
    select: { id: true },
  })

  if (existing) {
    throw new DomainError(
      "RECURRING_OCCURRENCE_EXISTS",
      "An expense already exists for this recurring occurrence."
    )
  }

  const nextDueOn = addRecurringPeriod(
    rule.nextDueOn,
    rule.frequency,
    rule.intervalCount
  )
  const shouldEnd = Boolean(rule.endOn && nextDueOn > rule.endOn)

  return db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        recurringExpenseId: rule.id,
        amount: rule.amount,
        currency: rule.currency,
        spentOn,
        description: rule.description,
        notes: "Generated from an approved recurring expense rule.",
        status: "PENDING",
      },
    })

    const updatedRule = await tx.recurringExpense.update({
      where: { id: rule.id },
      data: {
        nextDueOn,
        status: shouldEnd ? "ENDED" : rule.status,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "recurring_expense.occurrence_generated",
        entityType: "Expense",
        entityId: expense.id,
        after: {
          recurringExpenseId: rule.id,
          spentOn: formatDateOnly(spentOn),
          amount: rule.amount.toFixed(2),
          nextDueOn: formatDateOnly(updatedRule.nextDueOn),
          status: updatedRule.status,
        },
      },
    })

    return {
      expenseId: expense.id,
      nextDueOn: formatDateOnly(updatedRule.nextDueOn),
      status: updatedRule.status,
    }
  })
}

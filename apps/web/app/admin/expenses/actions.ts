"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  createRecurringExpenseSchema,
  deleteExpenseCategorySchema,
  deleteExpenseDocumentSchema,
  deleteExpenseSchema,
  deleteRecurringExpenseSchema,
  generateRecurringExpenseSchema,
  markExpensePaidSchema,
  recurringExpenseActionSchema,
  toggleExpenseCategorySchema,
} from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import {
  createExpenseCategory,
  deleteExpenseCategory,
  setExpenseCategoryActive,
} from "@/server/accounting/categories"
import { deleteExpenseDocument } from "@/server/accounting/documents"
import {
  createExpense,
  deleteExpense,
  markExpensePaid,
} from "@/server/accounting/expenses"
import {
  changeRecurringExpenseStatus,
  createRecurringExpense,
  deleteRecurringExpense,
  generateRecurringExpense,
} from "@/server/accounting/recurring"

export type ExpenseActionResult = {
  ok: boolean
  error?: string
  expenseId?: string
}

function actionError(error: unknown): ExpenseActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Expense action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function createExpenseAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = createExpenseSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid expense details.",
    }
  }

  try {
    const expense = await createExpense(admin.id, parsed.data)
    revalidatePath("/admin/expenses")
    revalidatePath("/admin")
    return { ok: true, expenseId: expense.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function markExpensePaidAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = markExpensePaidSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid payment details.",
    }
  }

  try {
    await markExpensePaid(admin.id, parsed.data)
    revalidatePath("/admin/expenses")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createExpenseCategoryAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = createExpenseCategorySchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid category details.",
    }
  }

  try {
    await createExpenseCategory(admin.id, parsed.data)
    revalidatePath("/admin/expenses")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function toggleExpenseCategoryAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = toggleExpenseCategorySchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid category status change." }
  }

  try {
    await setExpenseCategoryActive(
      admin.id,
      parsed.data.categoryId,
      parsed.data.isActive
    )
    revalidatePath("/admin/expenses")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createRecurringExpenseAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = createRecurringExpenseSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid recurring details.",
    }
  }

  try {
    await createRecurringExpense(admin.id, parsed.data)
    revalidatePath("/admin/expenses")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function changeRecurringExpenseStatusAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = recurringExpenseActionSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid recurring expense action." }
  }

  try {
    await changeRecurringExpenseStatus(admin.id, parsed.data)
    revalidatePath("/admin/expenses")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function generateRecurringExpenseAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = generateRecurringExpenseSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid recurring expense." }
  }

  try {
    const result = await generateRecurringExpense(
      admin.id,
      parsed.data.recurringExpenseId
    )
    revalidatePath("/admin/expenses")
    revalidatePath("/admin")
    return { ok: true, expenseId: result.expenseId }
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteExpenseDocumentAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteExpenseDocumentSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid document." }
  }

  try {
    await deleteExpenseDocument(admin.id, parsed.data.documentId)
    revalidatePath("/admin/expenses")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteExpenseAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteExpenseSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid expense." }
  }

  try {
    await deleteExpense(admin.id, parsed.data.expenseId)
    revalidatePath("/admin/expenses")
    revalidatePath("/admin/accounts")
    revalidatePath("/admin/income")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteExpenseCategoryAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteExpenseCategorySchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid category." }
  }

  try {
    await deleteExpenseCategory(admin.id, parsed.data.categoryId)
    revalidatePath("/admin/expenses")
    revalidatePath("/admin/accounts")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteRecurringExpenseAction(
  input: unknown
): Promise<ExpenseActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteRecurringExpenseSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid recurring expense." }
  }

  try {
    await deleteRecurringExpense(admin.id, parsed.data.recurringExpenseId)
    revalidatePath("/admin/expenses")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

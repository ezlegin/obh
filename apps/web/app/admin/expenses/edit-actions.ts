"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import { updateExpenseSchema } from "@/lib/validation/record-updates"
import { DomainError } from "@/server/errors"
import { updateExpense } from "@/server/accounting/record-updates"

export type ExpenseEditResult = { ok: boolean; error?: string }

export async function updateExpenseAction(
  input: unknown
): Promise<ExpenseEditResult> {
  const admin = await requireAdmin()
  const parsed = updateExpenseSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid expense details.",
    }
  }

  try {
    await updateExpense(admin.id, parsed.data)
    revalidatePath("/admin/expenses")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message }
    }

    console.error(
      "Expense update failed.",
      error instanceof Error ? error.name : "Unknown error"
    )

    return {
      ok: false,
      error: "The expense could not be updated. Please try again.",
    }
  }
}

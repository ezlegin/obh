"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  createIncomeSchema,
  deleteIncomeSchema,
} from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import { createIncome, deleteIncome } from "@/server/accounting/income"

export type IncomeActionResult = {
  ok: boolean
  error?: string
}

export async function createIncomeAction(
  input: unknown
): Promise<IncomeActionResult> {
  const admin = await requireAdmin()
  const parsed = createIncomeSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid income details.",
    }
  }

  try {
    await createIncome(admin.id, parsed.data)
    revalidatePath("/admin/income")
    revalidatePath("/admin/accounts")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message }
    }

    console.error(
      "Income action failed.",
      error instanceof Error ? error.name : "Unknown error"
    )

    return {
      ok: false,
      error: "The operation could not be completed. Please try again.",
    }
  }
}

export async function deleteIncomeAction(
  input: unknown
): Promise<IncomeActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteIncomeSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid income record." }
  }

  try {
    await deleteIncome(admin.id, parsed.data.incomeId)
    revalidatePath("/admin/income")
    revalidatePath("/admin/accounts")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message }
    }

    return {
      ok: false,
      error: "The income record could not be deleted.",
    }
  }
}

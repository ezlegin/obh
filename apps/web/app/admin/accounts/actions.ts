"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  createBusinessAccountSchema,
  toggleBusinessAccountSchema,
} from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import {
  createBusinessAccount,
  setBusinessAccountActive,
} from "@/server/accounting/accounts"

export type AccountingActionResult = {
  ok: boolean
  error?: string
}

function actionError(error: unknown): AccountingActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Business account action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function createBusinessAccountAction(
  input: unknown
): Promise<AccountingActionResult> {
  const admin = await requireAdmin()
  const parsed = createBusinessAccountSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid account details.",
    }
  }

  try {
    await createBusinessAccount(admin.id, parsed.data)
    revalidatePath("/admin/accounts")
    revalidatePath("/admin/expenses")
    revalidatePath("/admin/income")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function toggleBusinessAccountAction(
  input: unknown
): Promise<AccountingActionResult> {
  const admin = await requireAdmin()
  const parsed = toggleBusinessAccountSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid account status change." }
  }

  try {
    await setBusinessAccountActive(
      admin.id,
      parsed.data.accountId,
      parsed.data.isActive
    )
    revalidatePath("/admin/accounts")
    revalidatePath("/admin/expenses")
    revalidatePath("/admin/income")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

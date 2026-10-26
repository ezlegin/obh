"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import { updateBusinessAccountSchema } from "@/lib/validation/record-updates"
import { updateBusinessAccount } from "@/server/accounting/record-updates"
import { DomainError } from "@/server/errors"

export type AccountEditResult = { ok: boolean; error?: string }

export async function updateBusinessAccountAction(
  input: unknown
): Promise<AccountEditResult> {
  const admin = await requireAdmin()
  const parsed = updateBusinessAccountSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid account details.",
    }
  }

  try {
    await updateBusinessAccount(admin.id, parsed.data)
    revalidatePath("/admin/accounts")
    revalidatePath("/admin/expenses")
    revalidatePath("/admin/income")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message }
    }

    console.error(
      "Business account update failed.",
      error instanceof Error ? error.name : "Unknown error"
    )

    return {
      ok: false,
      error: "The payment source could not be updated. Please try again.",
    }
  }
}

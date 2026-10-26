"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import { updateIncomeSchema } from "@/lib/validation/record-updates"
import { updateIncome } from "@/server/accounting/record-updates"
import { DomainError } from "@/server/errors"

export type IncomeEditResult = { ok: boolean; error?: string }

export async function updateIncomeAction(
  input: unknown
): Promise<IncomeEditResult> {
  const admin = await requireAdmin()
  const parsed = updateIncomeSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid income details.",
    }
  }

  try {
    await updateIncome(admin.id, parsed.data)
    revalidatePath("/admin/income")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message }
    }

    console.error(
      "Income update failed.",
      error instanceof Error ? error.name : "Unknown error"
    )

    return {
      ok: false,
      error: "The income record could not be updated. Please try again.",
    }
  }
}

"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  updateProviderFeeSchema,
  updateReconciliationSchema,
  updateSettlementSchema,
} from "@/lib/validation/record-updates"
import {
  updateProviderFee,
  updateReconciliation,
  updateSettlement,
} from "@/server/accounting/record-updates"
import { DomainError } from "@/server/errors"

export type ReconciliationEditResult = { ok: boolean; error?: string }

function actionError(error: unknown): ReconciliationEditResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Reconciliation update failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The record could not be updated. Please try again.",
  }
}

export async function updateProviderFeeAction(
  input: unknown
): Promise<ReconciliationEditResult> {
  const admin = await requireAdmin()
  const parsed = updateProviderFeeSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid fee details.",
    }
  }

  try {
    await updateProviderFee(admin.id, parsed.data)
    revalidatePath("/admin/reconciliation")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateSettlementAction(
  input: unknown
): Promise<ReconciliationEditResult> {
  const admin = await requireAdmin()
  const parsed = updateSettlementSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid settlement details.",
    }
  }

  try {
    await updateSettlement(admin.id, parsed.data)
    revalidatePath("/admin/reconciliation")
    revalidatePath("/admin/accounts")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateReconciliationAction(
  input: unknown
): Promise<ReconciliationEditResult> {
  const admin = await requireAdmin()
  const parsed = updateReconciliationSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid reconciliation details.",
    }
  }

  try {
    await updateReconciliation(admin.id, parsed.data)
    revalidatePath("/admin/reconciliation")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

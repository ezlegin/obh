"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  recordProviderFeeSchema,
  recordReconciliationSchema,
  recordSettlementSchema,
} from "@/lib/validation/reconciliation"
import { DomainError } from "@/server/errors"
import {
  recordProviderFee,
  recordReconciliation,
  recordSettlement,
} from "@/server/reconciliation/service"

export type ReconciliationActionResult = {
  ok: boolean
  error?: string
}

function actionError(error: unknown): ReconciliationActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Reconciliation action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function recordProviderFeeAction(
  input: unknown
): Promise<ReconciliationActionResult> {
  const admin = await requireAdmin()
  const parsed = recordProviderFeeSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid fee details.",
    }
  }

  try {
    await recordProviderFee(admin.id, parsed.data)
    revalidatePath("/admin/reconciliation")
    revalidatePath("/admin/reports")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function recordSettlementAction(
  input: unknown
): Promise<ReconciliationActionResult> {
  const admin = await requireAdmin()
  const parsed = recordSettlementSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid settlement details.",
    }
  }

  try {
    await recordSettlement(admin.id, parsed.data)
    revalidatePath("/admin/reconciliation")
    revalidatePath("/admin/reports")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function recordReconciliationAction(
  input: unknown
): Promise<ReconciliationActionResult> {
  const admin = await requireAdmin()
  const parsed = recordReconciliationSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reconciliation.",
    }
  }

  try {
    await recordReconciliation(admin.id, parsed.data)
    revalidatePath("/admin/reconciliation")
    revalidatePath("/admin/reports")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  approveProfitPeriodSchema,
  calculateProfitPeriodSchema,
  deleteProfitPeriodSchema,
  recordShareholderPayoutSchema,
  updateRetentionPolicySchema,
} from "@/lib/validation/equity"
import { DomainError } from "@/server/errors"
import {
  approveProfitPeriod,
  calculateProfitPeriod,
  deleteProfitPeriod,
  recordShareholderPayout,
  updateRetentionPolicy,
} from "@/server/equity/profit"

export type DistributionActionResult = {
  ok: boolean
  error?: string
  profitPeriodId?: string
}

function actionError(error: unknown): DistributionActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Distribution action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function calculateProfitPeriodAction(
  input: unknown
): Promise<DistributionActionResult> {
  const admin = await requireAdmin()
  const parsed = calculateProfitPeriodSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid profit period.",
    }
  }

  try {
    const period = await calculateProfitPeriod(admin.id, parsed.data)
    revalidatePath("/admin/distributions")
    revalidatePath("/admin/reports")
    return { ok: true, profitPeriodId: period.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function approveProfitPeriodAction(
  input: unknown
): Promise<DistributionActionResult> {
  const admin = await requireAdmin()
  const parsed = approveProfitPeriodSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid profit period." }
  }

  try {
    await approveProfitPeriod(admin.id, parsed.data.profitPeriodId)
    revalidatePath("/admin/distributions")
    revalidatePath("/admin/reports")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function recordShareholderPayoutAction(
  input: unknown
): Promise<DistributionActionResult> {
  const admin = await requireAdmin()
  const parsed = recordShareholderPayoutSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid payout details.",
    }
  }

  try {
    await recordShareholderPayout(admin.id, parsed.data)
    revalidatePath("/admin/distributions")
    revalidatePath("/admin/reports")
    revalidatePath("/admin/accounts")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteProfitPeriodAction(
  input: unknown
): Promise<DistributionActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteProfitPeriodSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid profit period." }
  }

  try {
    await deleteProfitPeriod(admin.id, parsed.data.profitPeriodId)
    revalidatePath("/admin/distributions")
    revalidatePath("/admin/reports")
    revalidatePath("/admin/accounts")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateRetentionPolicyAction(
  input: unknown
): Promise<DistributionActionResult> {
  const admin = await requireAdmin()
  const parsed = updateRetentionPolicySchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid retention percentage.",
    }
  }

  try {
    await updateRetentionPolicy(admin.id, parsed.data.retentionPercentage)
    revalidatePath("/admin/distributions")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

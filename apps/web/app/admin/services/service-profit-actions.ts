"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  calculateServiceProfitSchema,
  deleteServiceProfitPeriodSchema,
  setServiceOwnershipSchema,
} from "@/lib/validation/services"
import { DomainError } from "@/server/errors"
import {
  calculateServiceProfitPeriod,
  deleteServiceProfitPeriod,
} from "@/server/services/service-profit"
import { setServiceOwnership } from "@/server/services/service-ownership"

export type ServiceProfitActionResult = {
  ok: boolean
  error?: string
  serviceProfitPeriodId?: string
}

function actionError(error: unknown): ServiceProfitActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Service profit action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function setServiceOwnershipAction(
  input: unknown
): Promise<ServiceProfitActionResult> {
  const admin = await requireAdmin()
  const parsed = setServiceOwnershipSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid ownership details.",
    }
  }

  try {
    await setServiceOwnership(admin.id, parsed.data)
    revalidatePath("/admin/services")
    revalidatePath(`/admin/services/${parsed.data.serviceId}`)
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function calculateServiceProfitAction(
  input: unknown
): Promise<ServiceProfitActionResult> {
  const admin = await requireAdmin()
  const parsed = calculateServiceProfitSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid calculation details.",
    }
  }

  try {
    const period = await calculateServiceProfitPeriod(admin.id, parsed.data)
    revalidatePath("/admin/services")
    revalidatePath(`/admin/services/${parsed.data.serviceId}`)
    revalidatePath("/admin")
    return { ok: true, serviceProfitPeriodId: period.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function deleteServiceProfitPeriodAction(
  input: unknown
): Promise<ServiceProfitActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteServiceProfitPeriodSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid service profit period." }
  }

  try {
    await deleteServiceProfitPeriod(admin.id, parsed.data.serviceProfitPeriodId)
    revalidatePath("/admin/services")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

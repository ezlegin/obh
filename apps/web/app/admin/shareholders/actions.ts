"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  createOwnershipRecordSchema,
  createShareholderSchema,
  endOwnershipRecordSchema,
  toggleShareholderSchema,
  updateShareholderSchema,
} from "@/lib/validation/equity"
import { DomainError } from "@/server/errors"
import {
  createOwnershipRecord,
  createShareholder,
  endOwnershipRecord,
  setShareholderActive,
  updateShareholder,
} from "@/server/equity/shareholders"

export type ShareholderActionResult = {
  ok: boolean
  error?: string
}

function actionError(error: unknown): ShareholderActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Shareholder action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function createShareholderAction(
  input: unknown
): Promise<ShareholderActionResult> {
  const admin = await requireAdmin()
  const parsed = createShareholderSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shareholder details.",
    }
  }

  try {
    await createShareholder(admin.id, parsed.data)
    revalidatePath("/admin/shareholders")
    revalidatePath("/admin/distributions")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateShareholderAction(
  input: unknown
): Promise<ShareholderActionResult> {
  const admin = await requireAdmin()
  const parsed = updateShareholderSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shareholder details.",
    }
  }

  try {
    await updateShareholder(admin.id, parsed.data)
    revalidatePath("/admin/shareholders")
    revalidatePath("/admin/distributions")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function toggleShareholderAction(
  input: unknown
): Promise<ShareholderActionResult> {
  const admin = await requireAdmin()
  const parsed = toggleShareholderSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid shareholder status change." }
  }

  try {
    await setShareholderActive(
      admin.id,
      parsed.data.shareholderId,
      parsed.data.isActive
    )
    revalidatePath("/admin/shareholders")
    revalidatePath("/admin/distributions")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createOwnershipRecordAction(
  input: unknown
): Promise<ShareholderActionResult> {
  const admin = await requireAdmin()
  const parsed = createOwnershipRecordSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid ownership details.",
    }
  }

  try {
    await createOwnershipRecord(admin.id, parsed.data)
    revalidatePath("/admin/shareholders")
    revalidatePath("/admin/distributions")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function endOwnershipRecordAction(
  input: unknown
): Promise<ShareholderActionResult> {
  const admin = await requireAdmin()
  const parsed = endOwnershipRecordSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid end date.",
    }
  }

  try {
    await endOwnershipRecord(
      admin.id,
      parsed.data.ownershipRecordId,
      parsed.data.effectiveTo
    )
    revalidatePath("/admin/shareholders")
    revalidatePath("/admin/distributions")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

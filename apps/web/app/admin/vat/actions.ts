"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  deleteVatReturnSchema,
  fileVatReturnSchema,
  markVatReturnPaidSchema,
  saveVatProfileSchema,
} from "@/lib/validation/vat"
import { DomainError } from "@/server/errors"
import {
  deleteVatReturn,
  fileVatReturn,
  markVatReturnPaid,
  saveVatProfile,
} from "@/server/vat/service"

export type VatActionResult = {
  ok: boolean
  error?: string
}

function revalidateVat() {
  revalidatePath("/admin/vat")
  revalidatePath("/admin/reports")
  revalidatePath("/admin")
}

async function run(
  action: () => Promise<unknown>,
  fallback: string
): Promise<VatActionResult> {
  try {
    await action()
    revalidateVat()
    return { ok: true }
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, error: error.message }
    }

    console.error(
      "VAT action failed.",
      error instanceof Error ? error.name : "Unknown error"
    )
    return { ok: false, error: fallback }
  }
}

export async function saveVatProfileAction(
  input: unknown
): Promise<VatActionResult> {
  const admin = await requireAdmin()
  const parsed = saveVatProfileSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid VAT registration.",
    }
  }

  return run(
    () => saveVatProfile(admin.id, parsed.data),
    "The VAT registration could not be saved."
  )
}

export async function fileVatReturnAction(
  input: unknown
): Promise<VatActionResult> {
  const admin = await requireAdmin()
  const parsed = fileVatReturnSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid VAT return." }
  }

  return run(
    () => fileVatReturn(admin.id, parsed.data),
    "The VAT return could not be recorded."
  )
}

export async function markVatReturnPaidAction(
  input: unknown
): Promise<VatActionResult> {
  const admin = await requireAdmin()
  const parsed = markVatReturnPaidSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid VAT return." }
  }

  return run(
    () => markVatReturnPaid(admin.id, parsed.data),
    "The payment could not be recorded."
  )
}

export async function deleteVatReturnAction(
  input: unknown
): Promise<VatActionResult> {
  const admin = await requireAdmin()
  const parsed = deleteVatReturnSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid VAT return." }
  }

  return run(
    () => deleteVatReturn(admin.id, parsed.data.returnId),
    "The VAT return could not be removed."
  )
}

"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import { deletePaymentSchema } from "@/lib/validation/payment-platform"
import { DomainError } from "@/server/errors"
import {
  deleteAllTestPayments,
  deletePayment,
} from "@/server/payments/payment-cleanup"

export type PaymentActionResult = {
  ok: boolean
  error?: string
}

function actionError(error: unknown): PaymentActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Payment action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function deleteAllTestPaymentsAction(): Promise<
  PaymentActionResult & { deleted?: number }
> {
  const admin = await requireAdmin()

  try {
    const { deleted } = await deleteAllTestPayments(admin.id)
    revalidatePath("/admin/payments")
    revalidatePath("/admin/installments")
    revalidatePath("/admin/reconciliation")
    revalidatePath("/admin")
    return { ok: true, deleted }
  } catch (error) {
    return actionError(error)
  }
}

export async function deletePaymentAction(
  input: unknown
): Promise<PaymentActionResult> {
  const admin = await requireAdmin()
  const parsed = deletePaymentSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid payment." }
  }

  try {
    await deletePayment(admin.id, parsed.data.paymentId)
    revalidatePath("/admin/payments")
    revalidatePath("/admin/reconciliation")
    revalidatePath("/admin")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

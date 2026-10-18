"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  createDevelopmentPaymentSchema,
  simulateDevelopmentResultSchema,
} from "@/lib/validation/payment-platform"
import { DomainError } from "@/server/errors"
import {
  createDevelopmentPayment,
  simulateDevelopmentPaymentResult,
} from "@/server/payments/payment-service"

export type PaymentActionResult = {
  ok: boolean
  error?: string
  paymentId?: string
  reference?: string
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

export async function createDevelopmentPaymentAction(
  input: unknown
): Promise<PaymentActionResult> {
  const admin = await requireAdmin()
  const parsed = createDevelopmentPaymentSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid payment details.",
    }
  }

  try {
    const result = await createDevelopmentPayment({
      actorId: admin.id,
      values: parsed.data,
    })

    revalidatePath("/admin/payments")
    revalidatePath("/admin")
    return {
      ok: true,
      paymentId: result.paymentId,
      reference: result.reference,
    }
  } catch (error) {
    return actionError(error)
  }
}

export async function simulateDevelopmentPaymentResultAction(
  input: unknown
): Promise<PaymentActionResult> {
  const admin = await requireAdmin()
  const parsed = simulateDevelopmentResultSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid simulated result." }
  }

  try {
    const payment = await simulateDevelopmentPaymentResult(
      admin.id,
      parsed.data
    )

    revalidatePath("/admin/payments")
    revalidatePath("/admin")

    return {
      ok: true,
      paymentId: payment.id,
      reference: payment.reference,
    }
  } catch (error) {
    return actionError(error)
  }
}

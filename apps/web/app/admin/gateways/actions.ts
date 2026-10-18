"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  createProviderAccountSchema,
  toggleProviderAccountSchema,
} from "@/lib/validation/payment-platform"
import { DomainError } from "@/server/errors"
import {
  createDevelopmentProviderAccount,
  ensureDevelopmentProvider,
  setProviderAccountActive,
} from "@/server/gateways/gateway-service"

export type GatewayActionResult = {
  ok: boolean
  error?: string
  providerId?: string
}

function actionError(error: unknown): GatewayActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Gateway action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function enableDevelopmentProviderAction(): Promise<GatewayActionResult> {
  const admin = await requireAdmin()

  try {
    const provider = await ensureDevelopmentProvider(admin.id)
    revalidatePath("/admin/gateways")
    revalidatePath("/admin/payments")
    return { ok: true, providerId: provider.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function createProviderAccountAction(
  input: unknown
): Promise<GatewayActionResult> {
  const admin = await requireAdmin()
  const parsed = createProviderAccountSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid account details.",
    }
  }

  try {
    await createDevelopmentProviderAccount(admin.id, parsed.data)
    revalidatePath("/admin/gateways")
    revalidatePath("/admin/payments")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function toggleProviderAccountAction(
  input: unknown
): Promise<GatewayActionResult> {
  const admin = await requireAdmin()
  const parsed = toggleProviderAccountSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid account status change." }
  }

  try {
    await setProviderAccountActive(
      admin.id,
      parsed.data.accountId,
      parsed.data.isActive
    )
    revalidatePath("/admin/gateways")
    revalidatePath("/admin/payments")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

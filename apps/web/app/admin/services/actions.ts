"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  createConnectedServiceSchema,
  issueServiceCredentialSchema,
  revokeServiceCredentialSchema,
  toggleConnectedServiceSchema,
} from "@/lib/validation/payment-platform"
import { DomainError } from "@/server/errors"
import {
  createConnectedService,
  issueServiceCredential,
  revokeServiceCredential,
  setConnectedServiceActive,
} from "@/server/services/connected-service"

export type ServiceActionResult = {
  ok: boolean
  error?: string
  presentedKey?: string
  credential?: {
    id: string
    keyId: string
    label: string
    environment: "TEST" | "LIVE"
    createdAt: string
  }
}

function actionError(error: unknown): ServiceActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message }
  }

  console.error(
    "Connected service action failed.",
    error instanceof Error ? error.name : "Unknown error"
  )

  return {
    ok: false,
    error: "The operation could not be completed. Please try again.",
  }
}

export async function registerConnectedServiceAction(
  input: unknown
): Promise<ServiceActionResult> {
  const admin = await requireAdmin()
  const parsed = createConnectedServiceSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid service details.",
    }
  }

  try {
    await createConnectedService(admin.id, parsed.data)
    revalidatePath("/admin/services")
    revalidatePath("/admin/payments")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function toggleConnectedServiceAction(
  input: unknown
): Promise<ServiceActionResult> {
  const admin = await requireAdmin()
  const parsed = toggleConnectedServiceSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid service status change." }
  }

  try {
    await setConnectedServiceActive(
      admin.id,
      parsed.data.serviceId,
      parsed.data.isActive
    )
    revalidatePath("/admin/services")
    revalidatePath("/admin/payments")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function issueServiceCredentialAction(
  input: unknown
): Promise<ServiceActionResult> {
  const admin = await requireAdmin()
  const parsed = issueServiceCredentialSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid credential details.",
    }
  }

  try {
    const result = await issueServiceCredential(admin.id, parsed.data)
    revalidatePath("/admin/services")

    return {
      ok: true,
      presentedKey: result.presentedKey,
      credential: {
        ...result.credential,
        createdAt: result.credential.createdAt.toISOString(),
      },
    }
  } catch (error) {
    return actionError(error)
  }
}

export async function revokeServiceCredentialAction(
  input: unknown
): Promise<ServiceActionResult> {
  const admin = await requireAdmin()
  const parsed = revokeServiceCredentialSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, error: "Invalid credential." }
  }

  try {
    await revokeServiceCredential(admin.id, parsed.data.credentialId)
    revalidatePath("/admin/services")
    return { ok: true }
  } catch (error) {
    return actionError(error)
  }
}

import "server-only"

import { getDb } from "@/lib/db/client"
import { ApiError } from "@/server/api/errors"
import { getSadadConfigStatus } from "@/server/payments/providers/registry"
import { verifyServiceSecret } from "@/server/payments/service-credentials"

export type ServiceAuthContext = {
  credentialId: string
  keyId: string
  environment: "TEST" | "LIVE"
  service: {
    id: string
    name: string
    slug: string
    domain: string
    allowedReturnUrls: string[]
    defaultReturnUrl: string | null
    webhookUrl: string | null
  }
}

export async function authenticateServiceRequest(
  request: Request
): Promise<ServiceAuthContext> {
  const header = request.headers.get("authorization")

  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(
      401,
      "AUTH_INVALID",
      "A valid service credential is required."
    )
  }

  const token = header.slice("Bearer ".length).trim()
  const separator = token.indexOf(".")

  if (separator <= 0 || separator === token.length - 1) {
    throw new ApiError(
      401,
      "AUTH_INVALID",
      "A valid service credential is required."
    )
  }

  const keyId = token.slice(0, separator)
  const secret = token.slice(separator + 1)

  if (keyId.length > 64 || secret.length > 256) {
    throw new ApiError(
      401,
      "AUTH_INVALID",
      "A valid service credential is required."
    )
  }

  const credential = await getDb().serviceCredential.findUnique({
    where: { keyId },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          allowedReturnUrls: true,
          defaultReturnUrl: true,
          webhookUrl: true,
          isActive: true,
        },
      },
    },
  })

  if (
    !credential ||
    credential.revokedAt ||
    !verifyServiceSecret(secret, credential.secretHash)
  ) {
    throw new ApiError(
      401,
      "AUTH_INVALID",
      "A valid service credential is required."
    )
  }

  if (!credential.service.isActive) {
    throw new ApiError(
      403,
      "SERVICE_INACTIVE",
      "This connected service is inactive."
    )
  }

  if (
    credential.environment === "LIVE" &&
    !getSadadConfigStatus().liveConfigured
  ) {
    throw new ApiError(
      503,
      "LIVE_NOT_AVAILABLE",
      "LIVE Sadad gateway credentials are not configured on the server."
    )
  }

  await getDb().serviceCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    credentialId: credential.id,
    keyId: credential.keyId,
    environment: credential.environment,
    service: {
      id: credential.service.id,
      name: credential.service.name,
      slug: credential.service.slug,
      domain: credential.service.domain,
      allowedReturnUrls: credential.service.allowedReturnUrls,
      defaultReturnUrl: credential.service.defaultReturnUrl,
      webhookUrl: credential.service.webhookUrl,
    },
  }
}

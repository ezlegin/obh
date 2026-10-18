import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type {
  CreateConnectedServiceInput,
  IssueServiceCredentialInput,
} from "@/lib/validation/payment-platform"
import { DomainError } from "@/server/errors"
import { generateServiceCredential } from "@/server/payments/service-credentials"

export async function createConnectedService(
  actorId: string,
  values: CreateConnectedServiceInput
) {
  const db = getDb()

  try {
    return await db.$transaction(async (tx) => {
      const service = await tx.connectedService.create({
        data: {
          name: values.name,
          slug: values.slug,
          domain: values.domain,
          description: values.description || null,
          allowedReturnUrls: values.allowedReturnUrls,
          defaultReturnUrl: values.defaultReturnUrl || null,
          webhookUrl: values.webhookUrl || null,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId,
          action: "connected_service.created",
          entityType: "ConnectedService",
          entityId: service.id,
          after: {
            name: service.name,
            slug: service.slug,
            domain: service.domain,
            isActive: service.isActive,
          },
        },
      })

      return service
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DomainError(
        "SERVICE_EXISTS",
        "A service with that slug or domain already exists."
      )
    }

    throw error
  }
}

export async function setConnectedServiceActive(
  actorId: string,
  serviceId: string,
  isActive: boolean
) {
  const db = getDb()

  const service = await db.connectedService.findUnique({
    where: { id: serviceId },
  })

  if (!service) {
    throw new DomainError("SERVICE_NOT_FOUND", "Service was not found.")
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.connectedService.update({
      where: { id: service.id },
      data: { isActive },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "connected_service.status_changed",
        entityType: "ConnectedService",
        entityId: service.id,
        before: { isActive: service.isActive },
        after: { isActive: updated.isActive },
      },
    })

    return updated
  })
}

export async function issueServiceCredential(
  actorId: string,
  values: IssueServiceCredentialInput
) {
  const db = getDb()

  const service = await db.connectedService.findUnique({
    where: { id: values.serviceId },
  })

  if (!service) {
    throw new DomainError("SERVICE_NOT_FOUND", "Service was not found.")
  }

  const credential = generateServiceCredential(values.environment)

  const stored = await db.$transaction(async (tx) => {
    const created = await tx.serviceCredential.create({
      data: {
        serviceId: service.id,
        keyId: credential.keyId,
        secretHash: credential.secretHash,
        label: values.label,
        environment: values.environment,
      },
      select: {
        id: true,
        keyId: true,
        label: true,
        environment: true,
        createdAt: true,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "service_credential.issued",
        entityType: "ServiceCredential",
        entityId: created.id,
        after: {
          serviceId: service.id,
          keyId: created.keyId,
          label: created.label,
          environment: created.environment,
        },
      },
    })

    return created
  })

  return {
    credential: stored,
    presentedKey: credential.presentedKey,
  }
}

export async function revokeServiceCredential(
  actorId: string,
  credentialId: string
) {
  const db = getDb()

  const credential = await db.serviceCredential.findUnique({
    where: { id: credentialId },
    select: {
      id: true,
      serviceId: true,
      keyId: true,
      revokedAt: true,
    },
  })

  if (!credential) {
    throw new DomainError("CREDENTIAL_NOT_FOUND", "Credential was not found.")
  }

  if (credential.revokedAt) {
    return credential
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.serviceCredential.update({
      where: { id: credential.id },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        serviceId: true,
        keyId: true,
        revokedAt: true,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "service_credential.revoked",
        entityType: "ServiceCredential",
        entityId: credential.id,
        after: {
          serviceId: credential.serviceId,
          keyId: credential.keyId,
          revokedAt: updated.revokedAt?.toISOString(),
        },
      },
    })

    return updated
  })
}

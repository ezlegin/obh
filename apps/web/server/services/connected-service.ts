import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type {
  CreateConnectedServiceInput,
  IssueServiceCredentialInput,
  UpdateConnectedServiceInput,
} from "@/lib/validation/payment-platform"
import { DomainError } from "@/server/errors"
import { generateServiceCredential } from "@/server/payments/service-credentials"
import {
  encryptServiceCredentialSecret,
  encryptWebhookSecret,
  generateWebhookSecret,
} from "@/server/payments/webhook-secret"

export async function createConnectedService(
  actorId: string,
  values: CreateConnectedServiceInput
) {
  const db = getDb()
  const generated = generateServiceCredential()
  const secretEncrypted = encryptServiceCredentialSecret(generated.presentedKey)

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

      const credential = await tx.serviceCredential.create({
        data: {
          serviceId: service.id,
          keyId: generated.keyId,
          secretHash: generated.secretHash,
          secretEncrypted,
          label: "API key",
          environment: generated.environment,
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
          action: "connected_service.created",
          entityType: "ConnectedService",
          entityId: service.id,
          after: {
            name: service.name,
            slug: service.slug,
            domain: service.domain,
            isActive: service.isActive,
            keyId: credential.keyId,
          },
        },
      })

      return {
        service,
        credential,
        presentedKey: generated.presentedKey,
      }
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

export async function updateConnectedService(
  actorId: string,
  values: UpdateConnectedServiceInput
) {
  const db = getDb()
  const service = await db.connectedService.findUnique({
    where: { id: values.serviceId },
  })

  if (!service) {
    throw new DomainError("SERVICE_NOT_FOUND", "Service was not found.")
  }

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.connectedService.update({
        where: { id: service.id },
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
          action: "connected_service.updated",
          entityType: "ConnectedService",
          entityId: service.id,
          before: {
            name: service.name,
            slug: service.slug,
            domain: service.domain,
            description: service.description,
            allowedReturnUrls: service.allowedReturnUrls,
            defaultReturnUrl: service.defaultReturnUrl,
            webhookUrl: service.webhookUrl,
          },
          after: {
            name: updated.name,
            slug: updated.slug,
            domain: updated.domain,
            description: updated.description,
            allowedReturnUrls: updated.allowedReturnUrls,
            defaultReturnUrl: updated.defaultReturnUrl,
            webhookUrl: updated.webhookUrl,
          },
        },
      })

      return updated
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
  const secretEncrypted = encryptServiceCredentialSecret(
    credential.presentedKey
  )

  const stored = await db.$transaction(async (tx) => {
    await tx.serviceCredential.deleteMany({
      where: { serviceId: service.id },
    })

    const created = await tx.serviceCredential.create({
      data: {
        serviceId: service.id,
        keyId: credential.keyId,
        secretHash: credential.secretHash,
        secretEncrypted,
        label: values.label || "API key",
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

export async function rotateWebhookSecret(actorId: string, serviceId: string) {
  const db = getDb()

  const service = await db.connectedService.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      name: true,
      webhookUrl: true,
      webhookSecretCreatedAt: true,
    },
  })

  if (!service) {
    throw new DomainError("SERVICE_NOT_FOUND", "Service was not found.")
  }

  if (!service.webhookUrl) {
    throw new DomainError(
      "WEBHOOK_NOT_CONFIGURED",
      "Add a webhook URL before creating a signing secret."
    )
  }

  const secret = generateWebhookSecret()
  const createdAt = new Date()

  await db.$transaction(async (tx) => {
    await tx.connectedService.update({
      where: { id: service.id },
      data: {
        webhookSecretEncrypted: encryptWebhookSecret(secret),
        webhookSecretCreatedAt: createdAt,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "connected_service.webhook_secret_rotated",
        entityType: "ConnectedService",
        entityId: service.id,
        before: {
          configured: Boolean(service.webhookSecretCreatedAt),
        },
        after: {
          configured: true,
          rotatedAt: createdAt.toISOString(),
        },
      },
    })
  })

  return {
    secret,
    createdAt: createdAt.toISOString(),
  }
}

export async function deleteConnectedService(
  actorId: string,
  serviceId: string
) {
  const db = getDb()

  const service = await db.connectedService.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      name: true,
      slug: true,
      domain: true,
    },
  })

  if (!service) {
    throw new DomainError("SERVICE_NOT_FOUND", "Service was not found.")
  }

  const profitPeriodCount = await db.serviceProfitPeriod.count({
    where: { serviceId: service.id },
  })

  if (profitPeriodCount > 0) {
    throw new DomainError(
      "SERVICE_HAS_DISTRIBUTIONS",
      "This service has calculated profit distributions. Delete them from the service page before deleting the service."
    )
  }

  await db.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { serviceId: service.id },
      data: { serviceId: null },
    })

    await tx.webhookDelivery.deleteMany({
      where: { serviceId: service.id },
    })

    await tx.paymentIdempotencyRecord.deleteMany({
      where: { serviceId: service.id },
    })

    await tx.serviceCredential.deleteMany({
      where: { serviceId: service.id },
    })

    await tx.connectedService.delete({
      where: { id: service.id },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "connected_service.deleted",
        entityType: "ConnectedService",
        entityId: service.id,
        before: {
          name: service.name,
          slug: service.slug,
          domain: service.domain,
        },
      },
    })
  })
}

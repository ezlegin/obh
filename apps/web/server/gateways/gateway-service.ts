import "server-only"

import { getDb } from "@/lib/db/client"
import { DomainError } from "@/server/errors"
import { DEVELOPMENT_PROVIDER_CODE } from "@/server/payments/providers/registry"

export async function ensureDevelopmentProvider(actorId: string) {
  const db = getDb()

  return db.$transaction(async (tx) => {
    const provider = await tx.paymentProvider.upsert({
      where: { code: DEVELOPMENT_PROVIDER_CODE },
      update: {
        isActive: true,
      },
      create: {
        code: DEVELOPMENT_PROVIDER_CODE,
        name: "Development Gateway",
        description:
          "Local-only adapter for exercising the OBH payment lifecycle. No real provider is contacted.",
        isActive: true,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider.development_enabled",
        entityType: "PaymentProvider",
        entityId: provider.id,
        after: {
          code: provider.code,
          name: provider.name,
          environment: "TEST",
        },
      },
    })

    return provider
  })
}

export async function createDevelopmentProviderAccount(
  actorId: string,
  input: {
    providerId: string
    name: string
    externalReference?: string
  }
) {
  const db = getDb()

  const provider = await db.paymentProvider.findUnique({
    where: { id: input.providerId },
  })

  if (
    !provider ||
    !provider.isActive ||
    provider.code !== DEVELOPMENT_PROVIDER_CODE
  ) {
    throw new DomainError(
      "PROVIDER_NOT_AVAILABLE",
      "The development provider is not enabled."
    )
  }

  const duplicate = await db.financialAccount.findFirst({
    where: {
      providerId: provider.id,
      name: input.name,
    },
    select: { id: true },
  })

  if (duplicate) {
    throw new DomainError(
      "ACCOUNT_EXISTS",
      "A provider account with that name already exists."
    )
  }

  return db.$transaction(async (tx) => {
    const account = await tx.financialAccount.create({
      data: {
        name: input.name,
        kind: "PROVIDER",
        providerId: provider.id,
        environment: "TEST",
        externalReference: input.externalReference || null,
        currency: "IRR",
        openingBalance: 0,
        notes:
          "Development provider account. No real funds or provider connection.",
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_account.development_created",
        entityType: "FinancialAccount",
        entityId: account.id,
        after: {
          provider: provider.code,
          name: account.name,
          environment: "TEST",
        },
      },
    })

    return account
  })
}

export async function setProviderAccountActive(
  actorId: string,
  accountId: string,
  isActive: boolean
) {
  const db = getDb()

  const account = await db.financialAccount.findUnique({
    where: { id: accountId },
    include: { provider: true },
  })

  if (
    !account ||
    account.kind !== "PROVIDER" ||
    account.provider?.code !== DEVELOPMENT_PROVIDER_CODE
  ) {
    throw new DomainError(
      "PROVIDER_ACCOUNT_NOT_FOUND",
      "Provider account was not found."
    )
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.financialAccount.update({
      where: { id: account.id },
      data: { isActive },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_account.status_changed",
        entityType: "FinancialAccount",
        entityId: account.id,
        before: { isActive: account.isActive },
        after: { isActive: updated.isActive },
      },
    })

    return updated
  })
}

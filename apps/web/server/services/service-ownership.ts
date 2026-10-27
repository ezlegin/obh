import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { SetServiceOwnershipInput } from "@/lib/validation/services"
import { DomainError } from "@/server/errors"

export type EffectiveOwnershipEntry = {
  shareholderId: string
  shareholderName: string
  percentage: Prisma.Decimal
}

export type EffectiveServiceOwnership = {
  source: "SERVICE" | "CORPORATE"
  entries: EffectiveOwnershipEntry[]
}

export async function getEffectiveServiceOwnership(
  serviceId: string,
  asOf: Date
): Promise<EffectiveServiceOwnership> {
  const db = getDb()
  const serviceShares = await db.serviceOwnershipShare.findMany({
    where: { serviceId },
    include: { shareholder: { select: { id: true, name: true } } },
  })

  if (serviceShares.length > 0) {
    return {
      source: "SERVICE",
      entries: serviceShares
        .map((share) => ({
          shareholderId: share.shareholderId,
          shareholderName: share.shareholder.name,
          percentage: share.percentage,
        }))
        .sort((left, right) =>
          left.shareholderName.localeCompare(right.shareholderName)
        ),
    }
  }

  const corporateRecords = await db.ownershipRecord.findMany({
    where: {
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    include: { shareholder: { select: { id: true, name: true } } },
  })

  const byShareholder = new Map<string, EffectiveOwnershipEntry>()

  for (const record of corporateRecords) {
    const current = byShareholder.get(record.shareholderId)
    byShareholder.set(record.shareholderId, {
      shareholderId: record.shareholderId,
      shareholderName: record.shareholder.name,
      percentage: (current?.percentage ?? new Prisma.Decimal(0)).plus(
        record.percentage
      ),
    })
  }

  return {
    source: "CORPORATE",
    entries: [...byShareholder.values()].sort((left, right) =>
      left.shareholderName.localeCompare(right.shareholderName)
    ),
  }
}

export async function setServiceOwnership(
  actorId: string,
  values: SetServiceOwnershipInput
) {
  const db = getDb()
  const service = await db.connectedService.findUnique({
    where: { id: values.serviceId },
    select: { id: true, name: true },
  })

  if (!service) {
    throw new DomainError("SERVICE_NOT_FOUND", "Service was not found.")
  }

  const shareholderIds = values.shares.map((share) => share.shareholderId)
  const shareholders = await db.shareholder.findMany({
    where: { id: { in: shareholderIds } },
    select: { id: true, name: true },
  })

  if (shareholders.length !== new Set(shareholderIds).size) {
    throw new DomainError(
      "SHAREHOLDER_NOT_FOUND",
      "One or more shareholders were not found."
    )
  }

  const shares = values.shares
    .map((share) => ({
      shareholderId: share.shareholderId,
      percentage: new Prisma.Decimal(share.percentage),
    }))
    .filter((share) => share.percentage.gt(0))

  const previous = await db.serviceOwnershipShare.findMany({
    where: { serviceId: service.id },
    include: { shareholder: { select: { name: true } } },
  })

  return db.$transaction(async (tx) => {
    await tx.serviceOwnershipShare.deleteMany({
      where: { serviceId: service.id },
    })

    if (shares.length > 0) {
      await tx.serviceOwnershipShare.createMany({
        data: shares.map((share) => ({
          serviceId: service.id,
          shareholderId: share.shareholderId,
          percentage: share.percentage,
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "service_ownership.updated",
        entityType: "ConnectedService",
        entityId: service.id,
        before: {
          mode: previous.length > 0 ? "SERVICE" : "CORPORATE",
          shares: previous.map((share) => ({
            shareholder: share.shareholder.name,
            percentage: share.percentage.toFixed(4),
          })),
        },
        after: {
          mode: shares.length > 0 ? "SERVICE" : "CORPORATE",
          shares: shares.map((share) => ({
            shareholderId: share.shareholderId,
            percentage: share.percentage.toFixed(4),
          })),
        },
      },
    })

    return { count: shares.length }
  })
}

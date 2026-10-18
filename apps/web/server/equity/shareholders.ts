import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { DomainError } from "@/server/errors"
import type {
  CreateOwnershipRecordInput,
  CreateShareholderInput,
  UpdateShareholderInput,
} from "@/lib/validation/equity"
import { parseDateOnly } from "@/server/accounting/dates"

export async function createShareholder(
  actorId: string,
  values: CreateShareholderInput
) {
  const db = getDb()

  return db.$transaction(async (tx) => {
    const shareholder = await tx.shareholder.create({
      data: {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "shareholder.created",
        entityType: "Shareholder",
        entityId: shareholder.id,
        after: { name: shareholder.name, email: shareholder.email },
      },
    })

    return shareholder
  })
}

export async function updateShareholder(
  actorId: string,
  values: UpdateShareholderInput
) {
  const db = getDb()
  const shareholder = await db.shareholder.findUnique({
    where: { id: values.shareholderId },
  })

  if (!shareholder) {
    throw new DomainError("SHAREHOLDER_NOT_FOUND", "Shareholder was not found.")
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.shareholder.update({
      where: { id: shareholder.id },
      data: {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "shareholder.updated",
        entityType: "Shareholder",
        entityId: shareholder.id,
        before: {
          name: shareholder.name,
          email: shareholder.email,
          phone: shareholder.phone,
        },
        after: {
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
        },
      },
    })

    return updated
  })
}

export async function setShareholderActive(
  actorId: string,
  shareholderId: string,
  isActive: boolean
) {
  const db = getDb()
  const shareholder = await db.shareholder.findUnique({
    where: { id: shareholderId },
  })

  if (!shareholder) {
    throw new DomainError("SHAREHOLDER_NOT_FOUND", "Shareholder was not found.")
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.shareholder.update({
      where: { id: shareholder.id },
      data: { isActive },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "shareholder.status_changed",
        entityType: "Shareholder",
        entityId: shareholder.id,
        before: { isActive: shareholder.isActive },
        after: { isActive: updated.isActive },
      },
    })

    return updated
  })
}

export async function createOwnershipRecord(
  actorId: string,
  values: CreateOwnershipRecordInput
) {
  const db = getDb()
  const shareholder = await db.shareholder.findUnique({
    where: { id: values.shareholderId },
  })

  if (!shareholder) {
    throw new DomainError("SHAREHOLDER_NOT_FOUND", "Shareholder was not found.")
  }

  const effectiveFrom = parseDateOnly(values.effectiveFrom)
  const effectiveTo = values.effectiveTo
    ? parseDateOnly(values.effectiveTo)
    : null
  const percentage = new Prisma.Decimal(values.percentage)

  const overlap = await db.ownershipRecord.findFirst({
    where: {
      shareholderId: shareholder.id,
      ...(effectiveTo ? { effectiveFrom: { lte: effectiveTo } } : {}),
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    select: { id: true },
  })

  if (overlap) {
    throw new DomainError(
      "OWNERSHIP_OVERLAP",
      "This shareholder already has an ownership record covering those dates."
    )
  }

  return db.$transaction(async (tx) => {
    const record = await tx.ownershipRecord.create({
      data: {
        shareholderId: shareholder.id,
        percentage,
        effectiveFrom,
        effectiveTo,
        note: values.note || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "ownership_record.created",
        entityType: "OwnershipRecord",
        entityId: record.id,
        after: {
          shareholderId: shareholder.id,
          percentage: percentage.toFixed(4),
          effectiveFrom: values.effectiveFrom,
          effectiveTo: values.effectiveTo || null,
        },
      },
    })

    return record
  })
}

export async function endOwnershipRecord(
  actorId: string,
  ownershipRecordId: string,
  effectiveToValue: string
) {
  const db = getDb()
  const record = await db.ownershipRecord.findUnique({
    where: { id: ownershipRecordId },
    include: { shareholder: { select: { name: true } } },
  })

  if (!record) {
    throw new DomainError(
      "OWNERSHIP_NOT_FOUND",
      "Ownership record was not found."
    )
  }

  if (record.effectiveTo) {
    throw new DomainError(
      "OWNERSHIP_ALREADY_ENDED",
      "This ownership record already has an end date."
    )
  }

  const effectiveTo = parseDateOnly(effectiveToValue)

  if (effectiveTo < record.effectiveFrom) {
    throw new DomainError(
      "OWNERSHIP_DATE_INVALID",
      "End date cannot be before the effective date."
    )
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.ownershipRecord.update({
      where: { id: record.id },
      data: { effectiveTo },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "ownership_record.ended",
        entityType: "OwnershipRecord",
        entityId: record.id,
        after: {
          shareholder: record.shareholder.name,
          effectiveTo: effectiveToValue,
        },
      },
    })

    return updated
  })
}

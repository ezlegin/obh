import "server-only"

import { getDb } from "@/lib/db/client"
import type {
  FileVatReturnInput,
  MarkVatReturnPaidInput,
  SaveVatProfileInput,
} from "@/lib/validation/vat"
import { vatQuarter } from "@/lib/vat/rules"
import {
  formatDateOnly,
  parseDateOnly,
  todayDateOnlyInTehran,
} from "@/server/accounting/dates"
import { DomainError } from "@/server/errors"
import { computeVatTotals } from "@/server/vat/totals"

export async function saveVatProfile(
  actorId: string,
  values: SaveVatProfileInput
) {
  const db = getDb()
  const before = await db.vatProfile.findUnique({ where: { id: "default" } })

  const filedReturns = await db.vatReturn.count()
  if (
    before &&
    filedReturns > 0 &&
    formatDateOnly(before.effectiveFrom) !== values.effectiveFrom
  ) {
    throw new DomainError(
      "VAT_RETURNS_FILED",
      "VAT returns are already recorded. Remove them before changing the registration date."
    )
  }

  const data = {
    stage: values.stage,
    effectiveFrom: parseDateOnly(values.effectiveFrom),
    economicCode: values.economicCode || null,
    notes: values.notes || null,
  }

  return db.$transaction(async (tx) => {
    const profile = await tx.vatProfile.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: before ? "vat_profile.updated" : "vat_profile.created",
        entityType: "VatProfile",
        entityId: profile.id,
        before: before
          ? {
              stage: before.stage,
              effectiveFrom: formatDateOnly(before.effectiveFrom),
              economicCode: before.economicCode,
            }
          : undefined,
        after: {
          stage: profile.stage,
          effectiveFrom: values.effectiveFrom,
          economicCode: profile.economicCode,
        },
      },
    })

    return profile
  })
}

/**
 * Freezes a finished quarter's figures as a filed return. Filing a quarter
 * before it ends is refused, since sales could still be added to it.
 */
export async function fileVatReturn(
  actorId: string,
  values: FileVatReturnInput
) {
  const db = getDb()
  const profile = await db.vatProfile.findUnique({ where: { id: "default" } })

  if (!profile) {
    throw new DomainError(
      "VAT_NOT_REGISTERED",
      "Save the VAT registration before filing a return."
    )
  }

  const quarter = vatQuarter(values.year, values.quarter)

  if (quarter.endsOn >= todayDateOnlyInTehran()) {
    throw new DomainError(
      "VAT_QUARTER_OPEN",
      "A quarter can only be filed after its last day."
    )
  }

  if (quarter.endsOn < formatDateOnly(profile.effectiveFrom)) {
    throw new DomainError(
      "VAT_QUARTER_BEFORE_REGISTRATION",
      "This quarter ended before the VAT registration date."
    )
  }

  const existing = await db.vatReturn.findUnique({
    where: { year_quarter: { year: values.year, quarter: values.quarter } },
  })

  if (existing) {
    throw new DomainError(
      "VAT_RETURN_EXISTS",
      "A return is already recorded for this quarter."
    )
  }

  const totals = await computeVatTotals({
    startsOn: quarter.startsOn,
    endsOn: quarter.endsOn,
    effectiveFrom: formatDateOnly(profile.effectiveFrom),
  })
  const now = new Date()

  return db.$transaction(async (tx) => {
    const filed = await tx.vatReturn.create({
      data: {
        year: quarter.year,
        quarter: quarter.quarter,
        startsOn: parseDateOnly(quarter.startsOn),
        endsOn: parseDateOnly(quarter.endsOn),
        dueOn: parseDateOnly(quarter.dueOn),
        taxableSales: totals.taxableSales,
        outputVat: totals.outputVat,
        purchases: totals.purchases,
        inputVat: totals.inputVat,
        netVat: totals.outputVat.minus(totals.inputVat),
        status: "FILED",
        filedAt: now,
        reference: values.reference || null,
        notes: values.notes || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "vat_return.filed",
        entityType: "VatReturn",
        entityId: filed.id,
        after: {
          year: filed.year,
          quarter: filed.quarter,
          taxableSales: filed.taxableSales.toFixed(2),
          outputVat: filed.outputVat.toFixed(2),
          inputVat: filed.inputVat.toFixed(2),
          netVat: filed.netVat.toFixed(2),
          reference: filed.reference,
        },
      },
    })

    return filed
  })
}

export async function markVatReturnPaid(
  actorId: string,
  values: MarkVatReturnPaidInput
) {
  const db = getDb()
  const existing = await db.vatReturn.findUnique({
    where: { id: values.returnId },
  })

  if (!existing) {
    throw new DomainError("VAT_RETURN_NOT_FOUND", "VAT return was not found.")
  }

  if (existing.status === "PAID") {
    throw new DomainError("VAT_RETURN_PAID", "This return is already paid.")
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.vatReturn.update({
      where: { id: existing.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        reference: values.reference || existing.reference,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "vat_return.paid",
        entityType: "VatReturn",
        entityId: existing.id,
        before: { status: existing.status },
        after: { status: updated.status, reference: updated.reference },
      },
    })

    return updated
  })
}

export async function deleteVatReturn(actorId: string, returnId: string) {
  const db = getDb()
  const existing = await db.vatReturn.findUnique({ where: { id: returnId } })

  if (!existing) {
    throw new DomainError("VAT_RETURN_NOT_FOUND", "VAT return was not found.")
  }

  await db.$transaction(async (tx) => {
    await tx.vatReturn.delete({ where: { id: existing.id } })
    await tx.auditLog.create({
      data: {
        actorId,
        action: "vat_return.deleted",
        entityType: "VatReturn",
        entityId: existing.id,
        before: {
          year: existing.year,
          quarter: existing.quarter,
          status: existing.status,
          netVat: existing.netVat.toFixed(2),
        },
      },
    })
  })
}

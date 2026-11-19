import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { DomainError } from "@/server/errors"
import { getVatEffectiveFrom } from "@/server/vat/totals"

/**
 * Validates the VAT portion entered on an income or expense record. VAT can
 * only be recorded once the company is registered, and it is always part of
 * (and so less than) the record's gross amount.
 */
export async function resolveRecordVat(input: {
  amount: Prisma.Decimal
  vatAmount?: string
  /** The record's date (`receivedOn` / `spentOn`). */
  dateOnly: string
}) {
  const vat = new Prisma.Decimal(input.vatAmount || "0")

  if (vat.isZero()) {
    return vat
  }

  const effectiveFrom = await getVatEffectiveFrom()

  if (!effectiveFrom) {
    throw new DomainError(
      "VAT_NOT_REGISTERED",
      "Set the VAT registration date on the VAT page before recording VAT."
    )
  }

  if (input.dateOnly < effectiveFrom) {
    throw new DomainError(
      "VAT_BEFORE_REGISTRATION",
      `VAT can only be recorded on or after the registration date (${effectiveFrom}).`
    )
  }

  if (!vat.lt(input.amount)) {
    throw new DomainError(
      "VAT_EXCEEDS_AMOUNT",
      "The VAT portion must be less than the total amount it is part of."
    )
  }

  return vat
}

import { Prisma } from "@/lib/generated/prisma/client"

/** The VAT inside a VAT-inclusive amount, rounded to whole rials. */
export function vatIncludedIn(
  grossAmount: Prisma.Decimal,
  ratePercent: number
) {
  return grossAmount
    .mul(ratePercent)
    .div(100 + ratePercent)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
}

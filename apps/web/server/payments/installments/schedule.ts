import { Prisma } from "@/lib/generated/prisma/client"

/** Digipay BNPL and credit purchases are repaid in four installments. */
export const DEFAULT_INSTALLMENT_COUNT = 4

/** Day of each Iranian month on which the gateway deposits installments. */
export const INSTALLMENT_SETTLEMENT_DAY = 7

/** Gateway purchase types that settle in installments rather than at once. */
export const INSTALLMENT_PURCHASE_TYPES = new Set(["BNPL", "CREDIT"])

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const persianParts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
})

const persianLabel = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})

const persianMonthLabel = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
})

function toUtcDate(dateOnly: string) {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    throw new Error("Date must use YYYY-MM-DD.")
  }
  return new Date(`${dateOnly}T00:00:00.000Z`)
}

/** Solar Hijri (Iranian) year, month and day of a Gregorian calendar day. */
export function persianDateParts(dateOnly: string) {
  const parts = persianParts.formatToParts(toUtcDate(dateOnly))
  const read = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value)

  return { year: read("year"), month: read("month"), day: read("day") }
}

/** e.g. `"Azar 7, 1405 AP"`. */
export function formatPersianDate(dateOnly: string) {
  return persianLabel.format(toUtcDate(dateOnly))
}

/** e.g. `"Azar 1405 AP"`. */
export function formatPersianMonth(dateOnly: string) {
  return persianMonthLabel.format(toUtcDate(dateOnly))
}

/**
 * The Gregorian dates of day `day` (default: the settlement day, the 7th) of
 * the `count` Iranian months that follow the month containing `fromDateOnly`.
 */
export function settlementDaysOfFollowingPersianMonths(
  fromDateOnly: string,
  count: number,
  day = INSTALLMENT_SETTLEMENT_DAY
) {
  const results: string[] = []
  const cursor = toUtcDate(fromDateOnly)

  // A Solar Hijri month has at most 31 days, so each step needs ≤ 32 days.
  for (
    let step = 0;
    results.length < count && step < 32 * (count + 1);
    step++
  ) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const dateOnly = cursor.toISOString().slice(0, 10)

    if (persianDateParts(dateOnly).day === 1) {
      // Every Iranian month has at least 29 days, so day ≤ 29 stays in it.
      const settlement = new Date(cursor.getTime())
      settlement.setUTCDate(settlement.getUTCDate() + day - 1)
      results.push(settlement.toISOString().slice(0, 10))
    }
  }

  return results
}

/**
 * Splits a whole Rial amount into `count` whole Rial installments. Any
 * remainder is added to the first installment, which the customer pays at
 * checkout, so later deposits are equal.
 */
export function splitInstallmentAmounts(totalAmount: string, count: number) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Installment count must be a positive integer.")
  }

  const total = new Prisma.Decimal(totalAmount)

  if (!total.isInteger() || total.lte(0)) {
    throw new Error("Installment total must be a positive whole Rial amount.")
  }

  const base = total.dividedToIntegerBy(count)
  const remainder = total.minus(base.times(count))

  return Array.from({ length: count }, (_, index) =>
    (index === 0 ? base.plus(remainder) : base).toFixed(0)
  )
}

export type InstallmentScheduleItem = {
  sequence: number
  amount: string
  dueOn: string
}

/**
 * Installment 1 is paid by the customer at checkout (`purchasedOn`); each
 * remaining installment is deposited on the 7th of the following Iranian
 * months. A purchase in Aban therefore settles on 7 Azar, 7 Dey and 7 Bahman.
 */
export function buildInstallmentSchedule(input: {
  totalAmount: string
  purchasedOn: string
  installmentCount?: number
}): InstallmentScheduleItem[] {
  const count = input.installmentCount ?? DEFAULT_INSTALLMENT_COUNT
  const amounts = splitInstallmentAmounts(input.totalAmount, count)
  const laterDates = settlementDaysOfFollowingPersianMonths(
    input.purchasedOn,
    count - 1
  )

  return amounts.map((amount, index) => ({
    sequence: index + 1,
    amount,
    dueOn: index === 0 ? input.purchasedOn : laterDates[index - 1]!,
  }))
}

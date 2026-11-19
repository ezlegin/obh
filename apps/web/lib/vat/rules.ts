/**
 * Pure VAT rules: the statutory rate by date, Solar Hijri quarters, return
 * deadlines, and splitting VAT out of a VAT-inclusive amount. Dates are
 * Gregorian `YYYY-MM-DD` strings for Tehran calendar days.
 */

/**
 * The general VAT rate (tax + municipal levy) by the Solar Hijri year it took
 * effect. Set yearly by the budget law: 9% under the 1400 VAT law, 10% from
 * 1403 (kept at 10% for 1404 and 1405). Add a row when a budget law changes it.
 */
export const VAT_RATE_HISTORY: ReadonlyArray<{
  fromPersianYear: number
  ratePercent: number
}> = [
  { fromPersianYear: 1400, ratePercent: 9 },
  { fromPersianYear: 1403, ratePercent: 10 },
]

/** Registration call stages (فراخوان) a company can be registered under. */
export const VAT_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const persianParts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
})

function toUtc(dateOnly: string) {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    throw new Error("Date must use YYYY-MM-DD.")
  }
  return new Date(`${dateOnly}T00:00:00.000Z`)
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDaysToDateOnly(dateOnly: string, days: number) {
  const date = toUtc(dateOnly)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateOnly(date)
}

export function toPersianParts(dateOnly: string) {
  const parts = persianParts.formatToParts(toUtc(dateOnly))
  const read = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value)

  return { year: read("year"), month: read("month"), day: read("day") }
}

const nowruzCache = new Map<number, string>()

/** Gregorian date of 1 Farvardin of the given Solar Hijri year. */
export function persianYearStart(persianYear: number) {
  const cached = nowruzCache.get(persianYear)
  if (cached) {
    return cached
  }

  const gregorianYear = persianYear + 621

  for (let day = 18; day <= 24; day++) {
    const candidate = `${gregorianYear}-03-${String(day).padStart(2, "0")}`
    const parts = toPersianParts(candidate)
    if (parts.year === persianYear && parts.month === 1 && parts.day === 1) {
      nowruzCache.set(persianYear, candidate)
      return candidate
    }
  }

  throw new Error(`Could not locate Nowruz for ${persianYear}.`)
}

/**
 * Gregorian date of day 1 of a Solar Hijri month. `month` may be 13, which
 * means Farvardin of the following year.
 */
export function persianMonthStart(persianYear: number, month: number) {
  if (month === 13) {
    return persianYearStart(persianYear + 1)
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.")
  }

  // Months 1–6 have 31 days and months 7–11 have 30.
  const offset = month <= 7 ? (month - 1) * 31 : 186 + (month - 7) * 30
  return addDaysToDateOnly(persianYearStart(persianYear), offset)
}

export type VatQuarter = {
  year: number
  quarter: number
  /** First day of the quarter. */
  startsOn: string
  /** Last day of the quarter (inclusive). */
  endsOn: string
  /** Last day to file and pay: the end of the month after the quarter. */
  dueOn: string
}

export function vatQuarter(persianYear: number, quarter: number): VatQuarter {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error("Quarter must be between 1 and 4.")
  }

  const firstMonth = (quarter - 1) * 3 + 1
  const startsOn = persianMonthStart(persianYear, firstMonth)
  const nextQuarterStart = persianMonthStart(persianYear, firstMonth + 3)
  // The month after the quarter is the first month of the next quarter.
  const [dueYear, dueMonth] =
    quarter === 4 ? [persianYear + 1, 1] : [persianYear, firstMonth + 3]
  const monthAfterDue = persianMonthStart(dueYear, dueMonth + 1)

  return {
    year: persianYear,
    quarter,
    startsOn,
    endsOn: addDaysToDateOnly(nextQuarterStart, -1),
    dueOn: addDaysToDateOnly(monthAfterDue, -1),
  }
}

export function vatQuarterOf(dateOnly: string): VatQuarter {
  const { year, month } = toPersianParts(dateOnly)
  return vatQuarter(year, Math.ceil(month / 3))
}

export function nextVatQuarter(current: Pick<VatQuarter, "year" | "quarter">) {
  return current.quarter === 4
    ? vatQuarter(current.year + 1, 1)
    : vatQuarter(current.year, current.quarter + 1)
}

/** Every quarter from the one containing `fromDateOnly` to the one containing `toDateOnly`. */
export function vatQuartersBetween(fromDateOnly: string, toDateOnly: string) {
  const quarters: VatQuarter[] = []
  if (toDateOnly < fromDateOnly) {
    return quarters
  }

  let cursor = vatQuarterOf(fromDateOnly)
  while (cursor.startsOn <= toDateOnly) {
    quarters.push(cursor)
    cursor = nextVatQuarter(cursor)
  }
  return quarters
}

export function vatRateOn(dateOnly: string) {
  const { year } = toPersianParts(dateOnly)
  let rate: number | null = null

  for (const entry of VAT_RATE_HISTORY) {
    if (year >= entry.fromPersianYear) {
      rate = entry.ratePercent
    }
  }

  if (rate === null) {
    throw new Error(`No VAT rate is defined for ${dateOnly}.`)
  }
  return rate
}

export type VatRateSegment = {
  /** First day (inclusive). */
  startsOn: string
  /** Last day (inclusive). */
  endsOn: string
  ratePercent: number
}

/**
 * Splits an inclusive date range into pieces with a single VAT rate each. Rates
 * only change at Nowruz, so a quarter is always one segment, while a Gregorian
 * month around March can be two.
 */
export function vatRateSegments(startsOn: string, endsOn: string) {
  const segments: VatRateSegment[] = []
  let cursor = startsOn

  while (cursor <= endsOn) {
    const { year } = toPersianParts(cursor)
    const yearEnd = addDaysToDateOnly(persianYearStart(year + 1), -1)
    const segmentEnd = yearEnd < endsOn ? yearEnd : endsOn
    segments.push({
      startsOn: cursor,
      endsOn: segmentEnd,
      ratePercent: vatRateOn(cursor),
    })
    cursor = addDaysToDateOnly(segmentEnd, 1)
  }

  return segments
}

/**
 * The VAT inside a VAT-inclusive amount of whole rials, rounded half up.
 * Works on any size of amount (BigInt), for form helpers in the browser.
 */
export function vatIncludedInRials(grossRials: bigint, ratePercent: number) {
  const rate = BigInt(ratePercent)
  const divisor = 100n + rate
  return (grossRials * rate * 2n + divisor) / (divisor * 2n)
}

/** Tehran midnight at the start of a calendar day, for timestamp filters. */
export function tehranStartOfDay(dateOnly: string) {
  toUtc(dateOnly)
  return new Date(`${dateOnly}T00:00:00+03:30`)
}

const quarterNames = ["Spring", "Summer", "Autumn", "Winter"]

/** e.g. `"1405 Q3 · Autumn"`. */
export function formatVatQuarterLabel(year: number, quarter: number) {
  return `${year} Q${quarter} · ${quarterNames[quarter - 1]}`
}

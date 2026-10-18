export type RecurringFrequencyValue =
  "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new Error("Date must use YYYY-MM-DD.")
  }

  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new Error("Date is invalid.")
  }

  return date
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function todayDateOnly(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function isDateOnlyDue(value: Date, now = new Date()) {
  return formatDateOnly(value) <= todayDateOnly(now)
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function addRecurringPeriod(
  value: Date,
  frequency: RecurringFrequencyValue,
  intervalCount = 1
) {
  const date = new Date(value.getTime())

  if (frequency === "WEEKLY") {
    date.setUTCDate(date.getUTCDate() + 7 * intervalCount)
    return date
  }

  const months =
    frequency === "MONTHLY"
      ? intervalCount
      : frequency === "QUARTERLY"
        ? 3 * intervalCount
        : 12 * intervalCount

  const originalDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  date.setUTCDate(
    Math.min(
      originalDay,
      daysInMonth(date.getUTCFullYear(), date.getUTCMonth())
    )
  )

  return date
}

export function startOfMonthDate(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  )
}

export function startOfNextMonthDate(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  )
}

export function formatFrequencyLabel(
  frequency: RecurringFrequencyValue,
  intervalCount: number
) {
  const base = {
    WEEKLY: "week",
    MONTHLY: "month",
    QUARTERLY: "quarter",
    YEARLY: "year",
  }[frequency]

  return intervalCount === 1
    ? `Every ${base}`
    : `Every ${intervalCount} ${base}s`
}

const TEHRAN_OFFSET = "+03:30"

export function parseMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("Month must use YYYY-MM.")
  }

  const [yearPart, monthPart] = value.split("-")
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error("Month is invalid.")
  }

  return { year, month }
}

export function monthRange(value: string) {
  const { year, month } = parseMonth(value)
  const startsOn = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  const lastDay = daysInMonth(year, month - 1)
  const endsOn = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  return {
    month: value,
    startsOn,
    endsOn,
    startInstant: new Date(`${startsOn}T00:00:00${TEHRAN_OFFSET}`),
    endInstant: new Date(`${nextMonthStart}T00:00:00${TEHRAN_OFFSET}`),
  }
}

export function currentMonthValue(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tehran",
  })
    .format(now)
    .slice(0, 7)
}

export function formatMonthLabel(value: string) {
  const { year, month } = parseMonth(value)
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function addDays(value: Date, days: number) {
  const date = new Date(value.getTime())
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

export function todayDateOnlyInTehran(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(now)
}

import {
  addDays,
  currentMonthValue,
  formatDateOnly,
  monthRange,
  parseDateOnly,
} from "@/server/accounting/dates"

export type ReportRange = {
  from: string
  to: string
  startInstant: Date
  endInstant: Date
  invalidMessage?: string
}

export function resolveReportRange(
  fromInput?: string,
  toInput?: string
): ReportRange {
  let from = fromInput
  let to = toInput
  let invalidMessage: string | undefined

  if (!from && !to) {
    const month = monthRange(currentMonthValue())
    from = month.startsOn
    to = month.endsOn
  } else if (!from && to) {
    if (isValidDate(to)) {
      const month = monthRange(to.slice(0, 7))
      from = month.startsOn
    }
  } else if (from && !to) {
    if (isValidDate(from)) {
      const month = monthRange(from.slice(0, 7))
      to = month.endsOn
    }
  }

  if (!from || !to || !isValidDate(from) || !isValidDate(to) || from > to) {
    const month = monthRange(currentMonthValue())
    return {
      from: month.startsOn,
      to: month.endsOn,
      startInstant: month.startInstant,
      endInstant: month.endInstant,
      invalidMessage: "Enter a valid date range with the start before the end.",
    }
  }

  const startInstant = new Date(`${from}T00:00:00+03:30`)
  const endDate = parseDateOnly(to)
  const endInstant = new Date(
    `${formatDateOnly(addDays(endDate, 1))}T00:00:00+03:30`
  )

  return { from, to, startInstant, endInstant, invalidMessage }
}

function isValidDate(value: string) {
  try {
    parseDateOnly(value)
    return true
  } catch {
    return false
  }
}

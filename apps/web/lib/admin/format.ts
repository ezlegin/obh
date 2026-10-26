const irrFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatIrr(value: number) {
  return `${irrFormatter.format(value)} R`
}

/**
 * Formats a Prisma Decimal serialized as a string without converting it to a
 * JavaScript floating-point number.
 */
export function formatIrrDecimal(value: string) {
  const negative = value.startsWith("-")
  const normalized = negative ? value.slice(1) : value
  const [integerPart = "0", fractionPart = ""] = normalized.split(".")
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const fraction = fractionPart.replace(/0+$/, "")
  const formatted = fraction ? `${grouped}.${fraction}` : grouped

  return `${negative ? "-" : ""}${formatted} R`
}

export function formatCompactIrr(value: number) {
  return compactFormatter.format(value)
}

export function formatDevelopmentDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Tehran",
  }).format(new Date(value))
}

export function formatDevelopmentDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(new Date(value))
}

/**
 * Accounting dates are date-only values. Format them in UTC so the displayed
 * calendar date never shifts with the viewer's timezone.
 */
export function formatAccountingDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

export function formatAccountingMonth(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00.000Z`))
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function todayInputValue() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

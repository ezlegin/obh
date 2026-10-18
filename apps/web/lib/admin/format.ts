const irrFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatIrr(value: number) {
  return `${irrFormatter.format(value)} IRR`
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

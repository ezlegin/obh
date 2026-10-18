const DANGEROUS_PREFIX = /^[=+\-@\t\r]/

export function escapeCsvCell(value: string) {
  const safe = DANGEROUS_PREFIX.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function csvNumber(value: string) {
  return /^-?\d+(?:\.\d+)?$/.test(value) ? value : escapeCsvCell(value)
}

export function toCsv(rows: string[][]) {
  return rows.map((row) => row.join(",")).join("\r\n")
}

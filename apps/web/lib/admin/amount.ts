export type AmountInputOptions = {
  allowNegative?: boolean
  allowDecimal?: boolean
}

/**
 * Stores the amount as a plain, schema-friendly string (no grouping
 * separators) while the field is edited.
 */
export function normalizeAmountInput(
  value: string,
  { allowNegative = false, allowDecimal = true }: AmountInputOptions = {}
) {
  let next = value.replace(/,/g, "").replace(/[^\d.-]/g, "")
  const negative = allowNegative && next.startsWith("-")

  next = next.replace(/-/g, "")

  const [integerPart = "", ...fractionParts] = next.split(".")
  const hasDecimalPoint = allowDecimal && next.includes(".")
  const integer = integerPart.replace(/^0+(?=\d)/, "")
  const fraction = allowDecimal ? fractionParts.join("").slice(0, 2) : ""

  return `${negative ? "-" : ""}${integer}${
    hasDecimalPoint ? `.${fraction}` : ""
  }`
}

/** Groups the integer part with thousands separators for display. */
export function formatAmountInput(value: string) {
  if (!value) {
    return ""
  }

  const negative = value.startsWith("-")
  const unsigned = negative ? value.slice(1) : value
  const [integer = "", fraction] = unsigned.split(".")
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  return `${negative ? "-" : ""}${grouped}${
    unsigned.includes(".") ? `.${fraction ?? ""}` : ""
  }`
}

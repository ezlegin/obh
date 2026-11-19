"use client"

import { useEffect, useState } from "react"

import { formatIrrDecimal } from "@/lib/admin/format"
import { vatIncludedInRials, vatRateOn } from "@/lib/vat/rules"

function rateFor(dateOnly: string) {
  try {
    return vatRateOn(dateOnly)
  } catch {
    return null
  }
}

/**
 * The VAT inside a record's total. While "includes VAT" is ticked the VAT is
 * recalculated from the total (amount × rate ÷ (100 + rate)) every time the
 * amount or date changes. Before the VAT registration date there is no VAT.
 */
function VatAmountField({
  id,
  amount,
  dateOnly,
  vatAmount,
  vatEffectiveFrom,
  initiallyIncluded,
  onChange,
  error,
  hint,
}: {
  id: string
  /** Current total (VAT-inclusive), as a plain numeric string. */
  amount: string
  /** Current record date (`YYYY-MM-DD`). */
  dateOnly: string
  /** Current form value of the VAT field. */
  vatAmount: string | undefined
  /** VAT registration date, or null when VAT is not set up. */
  vatEffectiveFrom: string | null
  initiallyIncluded: boolean
  onChange: (vatAmount: string) => void
  error?: string
  hint: string
}) {
  const [included, setIncluded] = useState(initiallyIncluded)
  const rate = rateFor(dateOnly)
  const registered =
    vatEffectiveFrom !== null &&
    Boolean(dateOnly) &&
    dateOnly >= vatEffectiveFrom
  const wholeAmount = /^\d+/.exec(amount ?? "")?.[0] ?? ""
  const applies = included && registered && rate !== null

  const expected =
    applies && wholeAmount && wholeAmount !== "0"
      ? vatIncludedInRials(BigInt(wholeAmount), rate).toString()
      : ""

  useEffect(() => {
    if ((vatAmount ?? "") !== expected) {
      onChange(expected)
    }
  }, [expected, vatAmount, onChange])

  const note = !vatEffectiveFrom
    ? "VAT is not set up yet (see the VAT page), so no VAT is recorded."
    : !registered
      ? `No VAT before the registration date (${vatEffectiveFrom}).`
      : hint

  return (
    <div className="space-y-2 rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="flex items-center gap-2 text-xs font-medium"
        >
          <input
            id={id}
            type="checkbox"
            className="size-3.5 accent-current"
            checked={included}
            disabled={!registered}
            onChange={(event) => setIncluded(event.target.checked)}
          />
          Total includes {rate ?? 10}% VAT
        </label>
        <span className="text-xs tabular-nums">
          {applies && expected ? (
            <>
              <span className="text-muted-foreground">VAT </span>
              <span className="font-medium">{formatIrrDecimal(expected)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">No VAT</span>
          )}
        </span>
      </div>
      {applies && expected ? (
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {formatIrrDecimal(
            (BigInt(wholeAmount) - BigInt(expected)).toString()
          )}{" "}
          before VAT + {formatIrrDecimal(expected)} VAT ={" "}
          {formatIrrDecimal(wholeAmount)}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        <p className="text-[10px] leading-4 text-muted-foreground/60">{note}</p>
      )}
    </div>
  )
}

export { VatAmountField }

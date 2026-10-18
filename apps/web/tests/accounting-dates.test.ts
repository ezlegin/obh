import assert from "node:assert/strict"
import test from "node:test"

import {
  addRecurringPeriod,
  formatDateOnly,
  formatFrequencyLabel,
  isDateOnlyDue,
  parseDateOnly,
  startOfMonthDate,
  startOfNextMonthDate,
} from "../server/accounting/dates"

test("parses and formats date-only values without timezone drift", () => {
  assert.equal(formatDateOnly(parseDateOnly("2026-10-18")), "2026-10-18")
  assert.throws(() => parseDateOnly("2026-02-30"))
  assert.throws(() => parseDateOnly("18/10/2026"))
})

test("adds weekly and monthly recurrences", () => {
  assert.equal(
    formatDateOnly(addRecurringPeriod(parseDateOnly("2026-10-18"), "WEEKLY")),
    "2026-10-25"
  )
  assert.equal(
    formatDateOnly(addRecurringPeriod(parseDateOnly("2026-10-18"), "MONTHLY")),
    "2026-11-18"
  )
})

test("clamps month-end dates instead of overflowing", () => {
  assert.equal(
    formatDateOnly(addRecurringPeriod(parseDateOnly("2026-01-31"), "MONTHLY")),
    "2026-02-28"
  )
  assert.equal(
    formatDateOnly(addRecurringPeriod(parseDateOnly("2028-01-31"), "MONTHLY")),
    "2028-02-29"
  )
})

test("supports quarterly and yearly intervals", () => {
  assert.equal(
    formatDateOnly(
      addRecurringPeriod(parseDateOnly("2026-10-18"), "QUARTERLY")
    ),
    "2027-01-18"
  )
  assert.equal(
    formatDateOnly(addRecurringPeriod(parseDateOnly("2026-10-18"), "YEARLY")),
    "2027-10-18"
  )
  assert.equal(
    formatDateOnly(
      addRecurringPeriod(parseDateOnly("2026-10-18"), "MONTHLY", 3)
    ),
    "2027-01-18"
  )
})

test("calculates month boundaries and due dates", () => {
  const now = new Date("2026-10-18T12:00:00.000Z")
  assert.equal(formatDateOnly(startOfMonthDate(now)), "2026-10-01")
  assert.equal(formatDateOnly(startOfNextMonthDate(now)), "2026-11-01")
  assert.equal(isDateOnlyDue(parseDateOnly("2026-10-18"), now), true)
  assert.equal(isDateOnlyDue(parseDateOnly("2026-10-19"), now), false)
})

test("labels recurrence frequency", () => {
  assert.equal(formatFrequencyLabel("MONTHLY", 1), "Every month")
  assert.equal(formatFrequencyLabel("QUARTERLY", 2), "Every 2 quarters")
})

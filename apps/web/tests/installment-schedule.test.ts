import assert from "node:assert/strict"
import test from "node:test"

import {
  buildInstallmentSchedule,
  settlementDaysOfFollowingPersianMonths,
  persianDateParts,
  splitInstallmentAmounts,
} from "../server/payments/installments/schedule"

test("Gregorian dates convert to Solar Hijri parts", () => {
  assert.deepEqual(persianDateParts("2026-10-27"), {
    year: 1405,
    month: 8,
    day: 5,
  })
  assert.deepEqual(persianDateParts("2027-03-21"), {
    year: 1406,
    month: 1,
    day: 1,
  })
})

test("a purchase in Aban settles on 7 Azar, 7 Dey and 7 Bahman", () => {
  const schedule = buildInstallmentSchedule({
    totalAmount: "5000000",
    purchasedOn: "2026-10-27",
  })

  assert.deepEqual(schedule, [
    { sequence: 1, amount: "1250000", dueOn: "2026-10-27" },
    { sequence: 2, amount: "1250000", dueOn: "2026-11-28" },
    { sequence: 3, amount: "1250000", dueOn: "2026-12-28" },
    { sequence: 4, amount: "1250000", dueOn: "2027-01-27" },
  ])
})

test("a purchase before the 7th still waits for the next month", () => {
  // 3 Aban 1405 → 7 Azar, not 7 Aban.
  assert.deepEqual(settlementDaysOfFollowingPersianMonths("2026-10-25", 1), [
    "2026-11-28",
  ])
})

test("schedules cross the Iranian new year", () => {
  assert.deepEqual(settlementDaysOfFollowingPersianMonths("2027-02-25", 3), [
    "2027-03-27",
    "2027-04-27",
    "2027-05-28",
  ])
})

test("installment amounts are whole Rials and the remainder is paid at checkout", () => {
  assert.deepEqual(splitInstallmentAmounts("1000003", 4), [
    "250003",
    "250000",
    "250000",
    "250000",
  ])
  assert.throws(() => splitInstallmentAmounts("10.5", 4), /whole Rial/)
  assert.throws(() => splitInstallmentAmounts("100", 0), /positive integer/)
})

import assert from "node:assert/strict"
import test from "node:test"

import { Prisma } from "../lib/generated/prisma/client"
import { vatIncludedIn } from "../server/vat/amounts"
import {
  persianMonthStart,
  persianYearStart,
  vatIncludedInRials,
  vatQuarter,
  vatQuarterOf,
  vatQuartersBetween,
  vatRateOn,
  vatRateSegments,
} from "../lib/vat/rules"

test("locates Nowruz and Solar Hijri month starts", () => {
  assert.equal(persianYearStart(1403), "2024-03-20")
  assert.equal(persianYearStart(1405), "2026-03-21")
  assert.equal(persianMonthStart(1405, 7), "2026-09-23")
  assert.equal(persianMonthStart(1405, 13), persianYearStart(1406))
})

test("builds quarters with the end-of-next-month deadline", () => {
  const autumn = vatQuarter(1405, 3)
  assert.equal(autumn.startsOn, "2026-09-23") // 1 Mehr
  assert.equal(autumn.endsOn, "2026-12-21") // 30 Azar
  assert.equal(autumn.dueOn, "2027-01-20") // 30 Dey

  const winter = vatQuarter(1405, 4)
  assert.equal(winter.endsOn, "2027-03-20") // last day of Esfand
  assert.equal(winter.dueOn, "2027-04-20") // 31 Farvardin 1406

  const spring = vatQuarter(1405, 1)
  assert.equal(spring.dueOn, "2026-07-22") // 31 Tir
})

test("finds the quarter of a day and lists quarters in between", () => {
  assert.deepEqual(
    { ...vatQuarterOf("2026-11-19") },
    { ...vatQuarter(1405, 3) }
  )
  const quarters = vatQuartersBetween("2026-05-01", "2026-11-19")
  assert.deepEqual(
    quarters.map((q) => `${q.year}-${q.quarter}`),
    ["1405-1", "1405-2", "1405-3"]
  )
  assert.equal(vatQuartersBetween("2026-11-19", "2026-05-01").length, 0)
})

test("applies the statutory rate by year and splits ranges at Nowruz", () => {
  assert.equal(vatRateOn("2023-06-01"), 9)
  assert.equal(vatRateOn("2026-11-19"), 10)

  const march = vatRateSegments("2024-03-01", "2024-03-31")
  assert.deepEqual(march, [
    { startsOn: "2024-03-01", endsOn: "2024-03-19", ratePercent: 9 },
    { startsOn: "2024-03-20", endsOn: "2024-03-31", ratePercent: 10 },
  ])
})

test("extracts VAT from a VAT-inclusive amount", () => {
  assert.equal(
    vatIncludedIn(new Prisma.Decimal("1100000000"), 10).toFixed(0),
    "100000000"
  )
  assert.equal(vatIncludedIn(new Prisma.Decimal("109"), 9).toFixed(0), "9")
  assert.equal(vatIncludedInRials(1100000000n, 10), 100000000n)
  assert.equal(vatIncludedInRials(115n, 10), 10n) // 10.45 rounds down
  assert.equal(vatIncludedInRials(116n, 10), 11n) // 10.55 rounds up
})

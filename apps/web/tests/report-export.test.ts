import assert from "node:assert/strict"
import test from "node:test"

import { csvNumber, escapeCsvCell, toCsv } from "../server/reports/csv"
import { resolveReportRange } from "../server/reports/range"

test("escapes CSV text and neutralizes formula-like values", () => {
  assert.equal(escapeCsvCell("plain"), '"plain"')
  assert.equal(escapeCsvCell('a "quoted" value'), '"a ""quoted"" value"')
  assert.equal(escapeCsvCell("line\nbreak"), '"line\nbreak"')
  assert.equal(escapeCsvCell("=HYPERLINK()"), '"\'=HYPERLINK()"')
  assert.equal(escapeCsvCell("-10"), '"\'-10"')
})

test("keeps numeric CSV cells numeric", () => {
  assert.equal(csvNumber("-10.00"), "-10.00")
  assert.equal(csvNumber("0"), "0")
  assert.equal(csvNumber("not-numeric"), '"not-numeric"')
})

test("joins CSV rows", () => {
  assert.equal(
    toCsv([
      ['"a"', '"b"'],
      ["1", "2"],
    ]),
    '"a","b"\r\n1,2'
  )
})

test("builds an inclusive report range on Tehran boundaries", () => {
  const range = resolveReportRange("2026-10-01", "2026-10-31")
  assert.equal(range.invalidMessage, undefined)
  assert.equal(range.from, "2026-10-01")
  assert.equal(range.to, "2026-10-31")
  assert.equal(range.startInstant.toISOString(), "2026-09-30T20:30:00.000Z")
  assert.equal(range.endInstant.toISOString(), "2026-10-31T20:30:00.000Z")
})

test("fills a missing range boundary from the supplied month", () => {
  const range = resolveReportRange("2026-02-01", undefined)
  assert.equal(range.from, "2026-02-01")
  assert.equal(range.to, "2026-02-28")
})

test("rejects reversed ranges and falls back to the current month", () => {
  const range = resolveReportRange("2026-10-31", "2026-10-01")
  assert.equal(
    range.invalidMessage,
    "Enter a valid date range with the start before the end."
  )
  assert.equal(range.from, range.from.slice(0, 7) + "-01")
})

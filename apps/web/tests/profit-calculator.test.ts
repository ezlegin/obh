import assert from "node:assert/strict"
import test from "node:test"

import { Prisma } from "../lib/generated/prisma/client"
import {
  allocateWholeIrr,
  applyCompanyRetention,
  applyLossCarryforward,
  calculateNetProfit,
  validateOwnershipTotal,
} from "../server/equity/profit-calculator"
import { monthRange } from "../server/accounting/dates"

const decimal = (value: string | number) => new Prisma.Decimal(value)

test("calculates net profit after expenses, fees, reserve, and tax", () => {
  const result = calculateNetProfit({
    revenue: decimal(1000),
    expenses: decimal(200),
    providerFees: decimal(50),
    reserveAmount: decimal(100),
    taxAmount: decimal(30),
  })

  assert.equal(result.toFixed(2), "620.00")
})

test("applies prior losses before distributing profit", () => {
  const result = applyLossCarryforward({
    netProfit: decimal(1500),
    priorLossBalance: decimal(1000),
  })

  assert.equal(result.applied.toFixed(2), "1000.00")
  assert.equal(result.distributable.toFixed(2), "500.00")
  assert.equal(result.lossAfter.toFixed(2), "0.00")
})

test("adds a loss to the carryforward balance", () => {
  const result = applyLossCarryforward({
    netProfit: decimal(-500),
    priorLossBalance: decimal(1000),
  })

  assert.equal(result.applied.toFixed(2), "0.00")
  assert.equal(result.distributable.toFixed(2), "0.00")
  assert.equal(result.lossAfter.toFixed(2), "1500.00")
})

test("allocates whole IRR and retains rounding residual", () => {
  const exact = allocateWholeIrr(decimal(1000), [
    { shareholderId: "a", percentage: "50.0000" },
    { shareholderId: "b", percentage: "50.0000" },
  ])
  assert.deepEqual(
    exact.allocations.map((allocation) => allocation.amount.toFixed(2)),
    ["500.00", "500.00"]
  )
  assert.equal(exact.unallocatedResidual.toFixed(2), "0.00")

  const rounding = allocateWholeIrr(decimal(1001), [
    { shareholderId: "a", percentage: "50.0000" },
    { shareholderId: "b", percentage: "50.0000" },
  ])
  assert.deepEqual(
    rounding.allocations.map((allocation) => allocation.amount.toFixed(2)),
    ["500.00", "500.00"]
  )
  assert.equal(rounding.unallocatedResidual.toFixed(2), "1.00")
})

test("requires period-end ownership to equal exactly 100%", () => {
  assert.throws(
    () =>
      validateOwnershipTotal([
        { shareholderId: "a", percentage: "60.0000" },
        { shareholderId: "b", percentage: "39.9999" },
      ]),
    /exactly 100/
  )
  assert.equal(
    validateOwnershipTotal([
      { shareholderId: "a", percentage: "60.0000" },
      { shareholderId: "b", percentage: "40.0000" },
    ]).toFixed(4),
    "100.0000"
  )
})

test("builds Tehran monthly ranges", () => {
  const october = monthRange("2026-10")
  assert.equal(october.startsOn, "2026-10-01")
  assert.equal(october.endsOn, "2026-10-31")
  assert.equal(october.startInstant.toISOString(), "2026-09-30T20:30:00.000Z")
  assert.equal(october.endInstant.toISOString(), "2026-10-31T20:30:00.000Z")

  const december = monthRange("2026-12")
  assert.equal(december.endsOn, "2026-12-31")
  assert.equal(december.endInstant.toISOString(), "2026-12-31T20:30:00.000Z")

  const february = monthRange("2028-02")
  assert.equal(february.endsOn, "2028-02-29")
})

test("retains configurable percentage in company and distributes remaining pool by unchanged ownership", () => {
  const netProfit = decimal(10_000_000)
  const retention = applyCompanyRetention({
    profitAfterLoss: netProfit,
    retentionPercentage: decimal(40),
  })

  assert.equal(retention.retainedFromPercentage.toFixed(2), "4000000.00")
  assert.equal(retention.totalRetained.toFixed(2), "4000000.00")
  assert.equal(retention.distributable.toFixed(2), "6000000.00")

  const allocation = allocateWholeIrr(retention.distributable, [
    { shareholderId: "shareholder-a", percentage: "60.0000" },
    { shareholderId: "shareholder-b", percentage: "40.0000" },
  ])

  assert.deepEqual(
    allocation.allocations.map((item) => ({
      shareholderId: item.shareholderId,
      percentage: item.percentage.toFixed(4),
      amount: item.amount.toFixed(2),
    })),
    [
      {
        shareholderId: "shareholder-a",
        percentage: "60.0000",
        amount: "3600000.00",
      },
      {
        shareholderId: "shareholder-b",
        percentage: "40.0000",
        amount: "2400000.00",
      },
    ]
  )
  assert.equal(allocation.unallocatedResidual.toFixed(2), "0.00")
})

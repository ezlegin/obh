import { Prisma } from "@/lib/generated/prisma/client"

export type OwnershipEntry = {
  shareholderId: string
  percentage: string
}

export type OwnershipAllocation = {
  shareholderId: string
  percentage: Prisma.Decimal
  amount: Prisma.Decimal
}

export function calculateNetProfit(input: {
  revenue: Prisma.Decimal
  expenses: Prisma.Decimal
  providerFees: Prisma.Decimal
  reserveAmount: Prisma.Decimal
  taxAmount: Prisma.Decimal
}) {
  return input.revenue
    .minus(input.expenses)
    .minus(input.providerFees)
    .minus(input.reserveAmount)
    .minus(input.taxAmount)
}

export function applyLossCarryforward(input: {
  netProfit: Prisma.Decimal
  priorLossBalance: Prisma.Decimal
}) {
  const priorLoss = Prisma.Decimal.max(
    new Prisma.Decimal(0),
    input.priorLossBalance
  )

  if (input.netProfit.isNegative()) {
    const lossCreated = input.netProfit.abs()
    return {
      applied: new Prisma.Decimal(0),
      distributable: new Prisma.Decimal(0),
      lossAfter: priorLoss.plus(lossCreated),
    }
  }

  const applied = Prisma.Decimal.min(input.netProfit, priorLoss)

  return {
    applied,
    distributable: input.netProfit.minus(applied),
    lossAfter: priorLoss.minus(applied),
  }
}

export function validateOwnershipTotal(entries: OwnershipEntry[]) {
  const total = entries.reduce(
    (sum, entry) => sum.plus(new Prisma.Decimal(entry.percentage)),
    new Prisma.Decimal(0)
  )

  if (!total.equals(100)) {
    throw new Error(
      `Ownership at the period end must total exactly 100.0000%, received ${total.toFixed(4)}%.`
    )
  }

  return total
}

export function allocateWholeIrr(
  distributable: Prisma.Decimal,
  entries: OwnershipEntry[]
) {
  const ownershipTotal = validateOwnershipTotal(entries)
  const allocations: OwnershipAllocation[] = entries.map((entry) => {
    const percentage = new Prisma.Decimal(entry.percentage)
    const amount = distributable.mul(percentage).div(100).floor()

    return {
      shareholderId: entry.shareholderId,
      percentage,
      amount,
    }
  })

  const allocated = allocations.reduce(
    (sum, allocation) => sum.plus(allocation.amount),
    new Prisma.Decimal(0)
  )

  return {
    ownershipTotal,
    allocations,
    unallocatedResidual: distributable.minus(allocated),
  }
}

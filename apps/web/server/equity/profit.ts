import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CalculateProfitPeriodInput } from "@/lib/validation/equity"
import { DomainError } from "@/server/errors"
import {
  currentMonthValue,
  monthRange,
  parseDateOnly,
} from "@/server/accounting/dates"
import {
  allocateWholeIrr,
  applyCompanyRetention,
  applyLossCarryforward,
  calculateNetProfit,
  type OwnershipAllocation,
} from "@/server/equity/profit-calculator"

export async function calculateProfitPeriod(
  actorId: string,
  values: CalculateProfitPeriodInput
) {
  const db = getDb()
  const range = monthRange(values.month)

  if (values.month > currentMonthValue()) {
    throw new DomainError(
      "PERIOD_IN_FUTURE",
      "A future month cannot be calculated."
    )
  }

  const startsOn = parseDateOnly(range.startsOn)
  const endsOn = parseDateOnly(range.endsOn)

  const existing = await db.profitPeriod.findUnique({
    where: { startsOn_endsOn: { startsOn, endsOn } },
    include: {
      distributions: {
        select: { id: true, status: true },
      },
    },
  })

  const hasPaidDistributions = existing?.distributions.some(
    (d) => d.status === "PAID"
  )

  if (hasPaidDistributions) {
    throw new DomainError(
      "PERIOD_LOCKED",
      "This profit period already has completed shareholder payouts. Remove the period first if you need to recalculate it."
    )
  }

  const [
    paymentRevenue,
    manualIncome,
    paidExpenses,
    providerFees,
    priorLossPeriod,
    ownershipRecords,
  ] = await Promise.all([
    db.payment.aggregate({
      where: {
        status: "COMPLETED",
        environment: "LIVE",
        currency: "IRR",
        completedAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
      },
      _sum: { amount: true },
    }),
    db.income.aggregate({
      where: {
        currency: "IRR",
        receivedOn: { gte: startsOn, lte: endsOn },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        status: "PAID",
        currency: "IRR",
        spentOn: { gte: startsOn, lte: endsOn },
      },
      _sum: { amount: true },
    }),
    db.providerFee.aggregate({
      where: {
        status: "SETTLED",
        currency: "IRR",
        chargedAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
        providerAccount: { environment: "LIVE" },
      },
      _sum: { amount: true },
    }),
    db.profitPeriod.findFirst({
      where: {
        endsOn: { lt: startsOn },
        status: { in: ["APPROVED", "CLOSED"] },
        lossBalanceAfter: { not: null },
      },
      orderBy: { endsOn: "desc" },
      select: { lossBalanceAfter: true },
    }),
    db.ownershipRecord.findMany({
      where: {
        effectiveFrom: { lte: endsOn },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: endsOn } }],
      },
      include: {
        shareholder: { select: { id: true, name: true } },
      },
    }),
  ])

  const revenue = (paymentRevenue._sum.amount ?? new Prisma.Decimal(0)).plus(
    manualIncome._sum.amount ?? new Prisma.Decimal(0)
  )
  const expenses = paidExpenses._sum.amount ?? new Prisma.Decimal(0)
  const fees = providerFees._sum.amount ?? new Prisma.Decimal(0)
  const retentionPercentage = new Prisma.Decimal(values.retentionPercentage)
  const additionalReserve = values.reserveAmount
    ? new Prisma.Decimal(values.reserveAmount)
    : new Prisma.Decimal(0)
  const taxAmount = new Prisma.Decimal(values.taxAmount)
  const netProfit = calculateNetProfit({
    revenue,
    expenses,
    providerFees: fees,
    taxAmount,
  })
  const priorLoss = priorLossPeriod?.lossBalanceAfter ?? new Prisma.Decimal(0)
  const loss = applyLossCarryforward({ netProfit, priorLossBalance: priorLoss })
  const retention = applyCompanyRetention({
    profitAfterLoss: loss.distributable,
    retentionPercentage,
    additionalReserveAmount: additionalReserve,
  })
  const reserveAmount = retention.totalRetained
  const distributableAfterRetention = retention.distributable

  const ownershipByShareholder = new Map<
    string,
    { shareholderId: string; percentage: Prisma.Decimal; name: string }
  >()

  for (const record of ownershipRecords) {
    const current = ownershipByShareholder.get(record.shareholderId)
    ownershipByShareholder.set(record.shareholderId, {
      shareholderId: record.shareholderId,
      percentage: (current?.percentage ?? new Prisma.Decimal(0)).plus(
        record.percentage
      ),
      name: record.shareholder.name,
    })
  }

  const ownershipEntries = [...ownershipByShareholder.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      shareholderId: entry.shareholderId,
      percentage: entry.percentage.toFixed(4),
    }))

  let allocation:
    | ReturnType<typeof allocateWholeIrr>
    | {
        ownershipTotal: Prisma.Decimal
        allocations: OwnershipAllocation[]
        unallocatedResidual: Prisma.Decimal
      }

  const ownershipTotal = ownershipEntries.reduce(
    (sum, entry) => sum.plus(new Prisma.Decimal(entry.percentage)),
    new Prisma.Decimal(0)
  )

  if (distributableAfterRetention.gt(0)) {
    try {
      allocation = allocateWholeIrr(
        distributableAfterRetention,
        ownershipEntries
      )
    } catch (error) {
      throw new DomainError(
        "OWNERSHIP_TOTAL_INVALID",
        error instanceof Error
          ? error.message
          : "Ownership at the period end must total exactly 100%."
      )
    }
  } else {
    allocation = {
      ownershipTotal,
      allocations: [],
      unallocatedResidual: new Prisma.Decimal(0),
    }
  }

  const payableAllocations = allocation.allocations.filter((item) =>
    item.amount.gt(0)
  )

  const now = new Date()
  const closesImmediately =
    !distributableAfterRetention.gt(0) || payableAllocations.length === 0
  const periodStatus = closesImmediately
    ? ("CLOSED" as const)
    : ("APPROVED" as const)

  return db.$transaction(async (tx) => {
    if (existing) {
      await tx.profitDistribution.deleteMany({
        where: { profitPeriodId: existing.id },
      })
    }

    const data = {
      totalRevenue: revenue,
      totalExpenses: expenses,
      providerFees: fees,
      retentionPercentage,
      reserveAmount,
      taxAmount,
      netProfit,
      lossBalanceBefore: priorLoss,
      lossApplied: loss.applied,
      lossBalanceAfter: loss.lossAfter,
      distributableAmount: distributableAfterRetention,
      unallocatedResidual: allocation.unallocatedResidual,
      ownershipTotal: allocation.ownershipTotal,
      calculatedAt: now,
      approvedAt: now,
      approvedById: actorId,
      closedAt: closesImmediately ? now : null,
      status: periodStatus,
      adjustmentNote: values.adjustmentNote || null,
    }

    const period = existing
      ? await tx.profitPeriod.update({
          where: { id: existing.id },
          data,
        })
      : await tx.profitPeriod.create({
          data: {
            startsOn,
            endsOn,
            currency: "IRR",
            ...data,
          },
        })

    if (payableAllocations.length > 0) {
      await tx.profitDistribution.createMany({
        data: payableAllocations.map((item) => ({
          profitPeriodId: period.id,
          shareholderId: item.shareholderId,
          percentageSnapshot: item.percentage,
          allocatedAmount: item.amount,
          currency: "IRR",
          status: "PENDING" as const,
          approvedAt: now,
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "profit_period.calculated",
        entityType: "ProfitPeriod",
        entityId: period.id,
        after: {
          month: range.month,
          revenue: revenue.toFixed(2),
          expenses: expenses.toFixed(2),
          providerFees: fees.toFixed(2),
          retentionPercentage: retentionPercentage.toFixed(4),
          retainedEarnings: reserveAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          netProfit: netProfit.toFixed(2),
          lossApplied: loss.applied.toFixed(2),
          distributable: distributableAfterRetention.toFixed(2),
          residual: allocation.unallocatedResidual.toFixed(2),
          ownershipTotal: allocation.ownershipTotal.toFixed(4),
        },
      },
    })

    return period
  })
}

export async function updateRetentionPolicy(
  actorId: string,
  retentionPercentageValue: string
) {
  const db = getDb()
  const pct = new Prisma.Decimal(retentionPercentageValue)

  await db.auditLog.create({
    data: {
      actorId,
      action: "retention_policy.updated",
      entityType: "RetentionPolicy",
      entityId: "default",
      after: {
        retentionPercentage: pct.toFixed(4),
      },
    },
  })

  return { retentionPercentage: pct.toFixed(2) }
}

export async function approveProfitPeriod(
  actorId: string,
  profitPeriodId: string
) {
  const db = getDb()
  const period = await db.profitPeriod.findUnique({
    where: { id: profitPeriodId },
    include: { distributions: true },
  })

  if (!period) {
    throw new DomainError("PERIOD_NOT_FOUND", "Profit period was not found.")
  }

  if (period.status !== "DRAFT") {
    throw new DomainError(
      "PERIOD_STATE_INVALID",
      "Only a draft profit period can be approved."
    )
  }

  if (!period.calculatedAt) {
    throw new DomainError(
      "PERIOD_NOT_CALCULATED",
      "Calculate the profit period before approval."
    )
  }

  const earlierDraft = await db.profitPeriod.findFirst({
    where: {
      startsOn: { lt: period.startsOn },
      status: "DRAFT",
    },
    select: { id: true },
  })

  if (earlierDraft) {
    throw new DomainError(
      "PERIOD_OUT_OF_ORDER",
      "An earlier draft profit period exists. Approve periods chronologically."
    )
  }

  const distributable = period.distributableAmount ?? new Prisma.Decimal(0)
  const allocated = period.distributions.reduce(
    (sum, distribution) => sum.plus(distribution.allocatedAmount),
    new Prisma.Decimal(0)
  )
  const residual = period.unallocatedResidual ?? new Prisma.Decimal(0)

  if (!allocated.plus(residual).equals(distributable)) {
    throw new DomainError(
      "ALLOCATION_MISMATCH",
      "Allocations and retained residual do not equal distributable profit."
    )
  }

  if (distributable.gte(1) && period.distributions.length === 0) {
    throw new DomainError(
      "ALLOCATION_MISSING",
      "No shareholder allocations exist for this profit period."
    )
  }

  const now = new Date()
  const closesImmediately =
    !distributable.gt(0) || period.distributions.length === 0

  return db.$transaction(async (tx) => {
    const updated = await tx.profitPeriod.update({
      where: { id: period.id },
      data: {
        status: closesImmediately ? "CLOSED" : "APPROVED",
        approvedAt: now,
        approvedById: actorId,
        closedAt: closesImmediately ? now : null,
      },
    })

    if (period.distributions.length > 0) {
      await tx.profitDistribution.updateMany({
        where: { profitPeriodId: period.id },
        data: { approvedAt: now },
      })
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "profit_period.approved",
        entityType: "ProfitPeriod",
        entityId: period.id,
        before: { status: period.status },
        after: {
          status: updated.status,
          distributable: distributable.toFixed(2),
          distributions: period.distributions.length,
        },
      },
    })

    return updated
  })
}

export async function recordShareholderPayout(
  actorId: string,
  values: {
    profitDistributionId: string
    accountId: string
    externalReference?: string
    note?: string
  }
) {
  const db = getDb()
  const distribution = await db.profitDistribution.findUnique({
    where: { id: values.profitDistributionId },
    include: {
      profitPeriod: true,
      payouts: true,
      shareholder: { select: { name: true } },
    },
  })

  if (!distribution) {
    throw new DomainError(
      "DISTRIBUTION_NOT_FOUND",
      "Profit distribution was not found."
    )
  }

  if (distribution.profitPeriod.status !== "APPROVED") {
    throw new DomainError(
      "PERIOD_NOT_APPROVED",
      "The profit period must be approved before payouts."
    )
  }

  if (!distribution.approvedAt) {
    throw new DomainError(
      "DISTRIBUTION_NOT_APPROVED",
      "This allocation has not been approved."
    )
  }

  if (distribution.status === "PAID") {
    throw new DomainError(
      "DISTRIBUTION_ALREADY_PAID",
      "This shareholder allocation is already paid."
    )
  }

  if (distribution.payouts.length > 0) {
    throw new DomainError(
      "PAYOUT_EXISTS",
      "A payout already exists for this shareholder allocation."
    )
  }

  if (!distribution.allocatedAmount.gt(0)) {
    throw new DomainError(
      "PAYOUT_ZERO",
      "A zero allocation cannot be paid out."
    )
  }

  const account = await db.financialAccount.findUnique({
    where: { id: values.accountId },
  })

  if (!account || account.kind !== "BUSINESS" || !account.isActive) {
    throw new DomainError(
      "ACCOUNT_NOT_FOUND",
      "Select an active business payment source."
    )
  }

  const now = new Date()

  return db.$transaction(async (tx) => {
    const payout = await tx.shareholderPayout.create({
      data: {
        profitDistributionId: distribution.id,
        accountId: account.id,
        amount: distribution.allocatedAmount,
        currency: distribution.currency,
        status: "COMPLETED",
        paidAt: now,
        externalReference: values.externalReference || null,
        note: values.note || null,
      },
    })

    await tx.profitDistribution.update({
      where: { id: distribution.id },
      data: { status: "PAID" },
    })

    const unpaid = await tx.profitDistribution.count({
      where: {
        profitPeriodId: distribution.profitPeriodId,
        status: { not: "PAID" },
        allocatedAmount: { gt: 0 },
      },
    })

    let periodClosed = false

    if (unpaid === 0) {
      await tx.profitPeriod.update({
        where: { id: distribution.profitPeriodId },
        data: { status: "CLOSED", closedAt: now },
      })
      periodClosed = true
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "shareholder_payout.completed",
        entityType: "ShareholderPayout",
        entityId: payout.id,
        after: {
          shareholder: distribution.shareholder.name,
          amount: distribution.allocatedAmount.toFixed(2),
          accountId: account.id,
          periodClosed,
        },
      },
    })

    return { payout, periodClosed }
  })
}

export async function deleteProfitPeriod(
  actorId: string,
  profitPeriodId: string
) {
  const db = getDb()
  const period = await db.profitPeriod.findUnique({
    where: { id: profitPeriodId },
    include: {
      distributions: { select: { id: true } },
    },
  })

  if (!period) {
    throw new DomainError("PERIOD_NOT_FOUND", "Profit period was not found.")
  }

  return db.$transaction(async (tx) => {
    const distributionIds = period.distributions.map((d) => d.id)
    if (distributionIds.length > 0) {
      await tx.shareholderPayout.deleteMany({
        where: { profitDistributionId: { in: distributionIds } },
      })
      await tx.profitDistribution.deleteMany({
        where: { profitPeriodId: period.id },
      })
    }
    await tx.profitPeriod.delete({
      where: { id: period.id },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "profit_period.deleted",
        entityType: "ProfitPeriod",
        entityId: period.id,
        before: {
          startsOn: period.startsOn.toISOString(),
          endsOn: period.endsOn.toISOString(),
          status: period.status,
        },
      },
    })
  })
}

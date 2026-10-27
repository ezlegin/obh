import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CalculateServiceProfitInput } from "@/lib/validation/services"
import { DomainError } from "@/server/errors"
import {
  currentMonthValue,
  monthRange,
  parseDateOnly,
} from "@/server/accounting/dates"
import { allocateWholeIrr } from "@/server/equity/profit-calculator"
import { getEffectiveServiceOwnership } from "@/server/services/service-ownership"

export async function calculateServiceProfitPeriod(
  actorId: string,
  values: CalculateServiceProfitInput
) {
  const db = getDb()
  const range = monthRange(values.month)

  if (values.month > currentMonthValue()) {
    throw new DomainError(
      "PERIOD_IN_FUTURE",
      "A future month cannot be calculated."
    )
  }

  const service = await db.connectedService.findUnique({
    where: { id: values.serviceId },
    select: { id: true, name: true, domain: true },
  })

  if (!service) {
    throw new DomainError("SERVICE_NOT_FOUND", "Service was not found.")
  }

  const startsOn = parseDateOnly(range.startsOn)
  const endsOn = parseDateOnly(range.endsOn)

  const [paymentRevenue, manualIncome, paidExpenses, providerFees, existing] =
    await Promise.all([
      db.payment.aggregate({
        where: {
          serviceId: service.id,
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
          serviceId: service.id,
          currency: "IRR",
          receivedOn: { gte: startsOn, lte: endsOn },
        },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: {
          serviceId: service.id,
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
          payment: { serviceId: service.id, environment: "LIVE" },
        },
        _sum: { amount: true },
      }),
      db.serviceProfitPeriod.findUnique({
        where: {
          serviceId_startsOn_endsOn: {
            serviceId: service.id,
            startsOn,
            endsOn,
          },
        },
        include: { distributions: { select: { id: true } } },
      }),
    ])

  const grossPayments = paymentRevenue._sum.amount ?? new Prisma.Decimal(0)
  const income = manualIncome._sum.amount ?? new Prisma.Decimal(0)
  const expenses = paidExpenses._sum.amount ?? new Prisma.Decimal(0)
  const fees = providerFees._sum.amount ?? new Prisma.Decimal(0)
  const netProfit = grossPayments.plus(income).minus(expenses).minus(fees)
  const distributableAmount = Prisma.Decimal.max(
    netProfit,
    new Prisma.Decimal(0)
  )

  const ownership = await getEffectiveServiceOwnership(service.id, endsOn)
  const ownershipEntries = ownership.entries.map((entry) => ({
    shareholderId: entry.shareholderId,
    percentage: entry.percentage.toFixed(4),
  }))
  const ownershipTotal = ownership.entries.reduce(
    (sum, entry) => sum.plus(entry.percentage),
    new Prisma.Decimal(0)
  )

  let allocations: ReturnType<typeof allocateWholeIrr>["allocations"] = []
  let unallocatedResidual = new Prisma.Decimal(0)

  if (distributableAmount.gt(0)) {
    if (ownershipEntries.length === 0) {
      throw new DomainError(
        "OWNERSHIP_MISSING",
        "Configure service ownership or corporation ownership before calculating a distribution."
      )
    }

    try {
      const allocation = allocateWholeIrr(distributableAmount, ownershipEntries)
      allocations = allocation.allocations
      unallocatedResidual = allocation.unallocatedResidual
    } catch (error) {
      throw new DomainError(
        "OWNERSHIP_TOTAL_INVALID",
        error instanceof Error
          ? error.message
          : "Ownership at the period end must total exactly 100%."
      )
    }
  }

  const payableAllocations = allocations.filter((item) => item.amount.gt(0))
  const now = new Date()

  return db.$transaction(async (tx) => {
    if (existing) {
      await tx.serviceProfitDistribution.deleteMany({
        where: { serviceProfitPeriodId: existing.id },
      })
    }

    const data = {
      grossPayments,
      manualIncome: income,
      totalExpenses: expenses,
      providerFees: fees,
      netProfit,
      distributableAmount,
      unallocatedResidual,
      ownershipTotal,
      ownershipSource: ownership.source,
      calculatedAt: now,
    }

    const period = existing
      ? await tx.serviceProfitPeriod.update({
          where: { id: existing.id },
          data,
        })
      : await tx.serviceProfitPeriod.create({
          data: {
            serviceId: service.id,
            startsOn,
            endsOn,
            currency: "IRR",
            ...data,
          },
        })

    if (payableAllocations.length > 0) {
      await tx.serviceProfitDistribution.createMany({
        data: payableAllocations.map((item) => ({
          serviceProfitPeriodId: period.id,
          shareholderId: item.shareholderId,
          percentageSnapshot: item.percentage,
          allocatedAmount: item.amount,
          currency: "IRR",
        })),
      })
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "service_profit_period.calculated",
        entityType: "ServiceProfitPeriod",
        entityId: period.id,
        after: {
          serviceId: service.id,
          service: service.name,
          month: range.month,
          grossPayments: grossPayments.toFixed(2),
          manualIncome: income.toFixed(2),
          expenses: expenses.toFixed(2),
          providerFees: fees.toFixed(2),
          netProfit: netProfit.toFixed(2),
          distributable: distributableAmount.toFixed(2),
          ownershipSource: ownership.source,
          ownershipTotal: ownershipTotal.toFixed(4),
          residual: unallocatedResidual.toFixed(2),
        },
      },
    })

    return period
  })
}

export async function deleteServiceProfitPeriod(
  actorId: string,
  serviceProfitPeriodId: string
) {
  const db = getDb()
  const period = await db.serviceProfitPeriod.findUnique({
    where: { id: serviceProfitPeriodId },
    include: { distributions: { select: { id: true } } },
  })

  if (!period) {
    throw new DomainError(
      "SERVICE_PERIOD_NOT_FOUND",
      "Service profit period was not found."
    )
  }

  await db.$transaction(async (tx) => {
    await tx.serviceProfitPeriod.delete({ where: { id: period.id } })
    await tx.auditLog.create({
      data: {
        actorId,
        action: "service_profit_period.deleted",
        entityType: "ServiceProfitPeriod",
        entityId: period.id,
        before: {
          serviceId: period.serviceId,
          startsOn: period.startsOn.toISOString().slice(0, 10),
          endsOn: period.endsOn.toISOString().slice(0, 10),
          distributions: period.distributions.length,
        },
      },
    })
  })
}

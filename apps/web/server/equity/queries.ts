import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import {
  currentMonthValue,
  formatDateOnly,
  parseDateOnly,
  todayDateOnlyInTehran,
} from "@/server/accounting/dates"

export type AdminOwnershipRecord = {
  id: string
  shareholderId: string
  shareholderName: string
  percentage: string
  effectiveFrom: string
  effectiveTo: string | null
  note: string | null
}

export type AdminShareholder = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  isActive: boolean
  currentPercentage: string
  records: AdminOwnershipRecord[]
  createdAt: string
}

export type ShareholderWorkspace = {
  shareholders: AdminShareholder[]
  currentTotal: string
  currentAsOf: string
  activeCount: number
  ownershipRecordCount: number
}

export async function getShareholderWorkspace(): Promise<ShareholderWorkspace> {
  const db = getDb()
  const todayValue = todayDateOnlyInTehran()
  const today = parseDateOnly(todayValue)

  const shareholders = await db.shareholder.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      ownershipRecords: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      },
    },
  })

  let currentTotal = new Prisma.Decimal(0)
  let historyCount = 0

  const mapped = shareholders.map((shareholder) => {
    const current = shareholder.ownershipRecords
      .filter(
        (record) =>
          record.effectiveFrom <= today &&
          (!record.effectiveTo || record.effectiveTo >= today)
      )
      .reduce(
        (sum, record) => sum.plus(record.percentage),
        new Prisma.Decimal(0)
      )

    currentTotal = currentTotal.plus(current)
    historyCount += shareholder.ownershipRecords.length

    return {
      id: shareholder.id,
      name: shareholder.name,
      email: shareholder.email,
      phone: shareholder.phone,
      notes: shareholder.notes,
      isActive: shareholder.isActive,
      currentPercentage: current.toFixed(4),
      createdAt: shareholder.createdAt.toISOString(),
      records: shareholder.ownershipRecords.map((record) => ({
        id: record.id,
        shareholderId: shareholder.id,
        shareholderName: shareholder.name,
        percentage: record.percentage.toFixed(4),
        effectiveFrom: formatDateOnly(record.effectiveFrom),
        effectiveTo: record.effectiveTo
          ? formatDateOnly(record.effectiveTo)
          : null,
        note: record.note,
      })),
    }
  })

  return {
    shareholders: mapped,
    currentTotal: currentTotal.toFixed(4),
    currentAsOf: todayValue,
    activeCount: shareholders.filter((shareholder) => shareholder.isActive)
      .length,
    ownershipRecordCount: historyCount,
  }
}

export type AdminProfitDistribution = {
  id: string
  shareholderId: string
  shareholderName: string
  percentage: string
  amount: string
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "VOIDED"
  approvedAt: string | null
  payout: {
    id: string
    amount: string
    status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED"
    paidAt: string | null
    accountName: string | null
    externalReference: string | null
    note: string | null
  } | null
}

export type AdminProfitPeriod = {
  id: string
  month: string
  startsOn: string
  endsOn: string
  status: "DRAFT" | "APPROVED" | "CLOSED" | "VOIDED"
  totalRevenue: string
  totalExpenses: string
  providerFees: string
  reserveAmount: string
  taxAmount: string
  netProfit: string
  lossBalanceBefore: string
  lossApplied: string
  lossBalanceAfter: string
  distributableAmount: string
  unallocatedResidual: string
  ownershipTotal: string
  adjustmentNote: string | null
  calculatedAt: string | null
  approvedAt: string | null
  approvedByName: string | null
  closedAt: string | null
  totalPaid: string
  distributions: AdminProfitDistribution[]
}

export type DistributionsWorkspace = {
  periods: AdminProfitPeriod[]
  accounts: Array<{ id: string; name: string }>
  currentMonth: string
  summary: {
    draftCount: number
    approvedCount: number
    closedCount: number
    totalDistributable: string
    totalPaid: string
    lossCarryforward: string
  }
}

export async function getDistributionsWorkspace(): Promise<DistributionsWorkspace> {
  const db = getDb()
  const [periods, accounts] = await Promise.all([
    db.profitPeriod.findMany({
      orderBy: { startsOn: "desc" },
      take: 60,
      include: {
        approvedBy: { select: { name: true } },
        distributions: {
          orderBy: { createdAt: "asc" },
          include: {
            shareholder: { select: { name: true } },
            payouts: {
              orderBy: { createdAt: "desc" },
              include: { account: { select: { name: true } } },
            },
          },
        },
      },
    }),
    db.financialAccount.findMany({
      where: { kind: "BUSINESS", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  let totalDistributable = new Prisma.Decimal(0)
  let totalPaid = new Prisma.Decimal(0)
  let draftCount = 0
  let approvedCount = 0
  let closedCount = 0
  let lossCarryforward = new Prisma.Decimal(0)
  let latestLossFound = false

  const mapped = periods.map((period) => {
    if (period.status === "DRAFT") {
      draftCount += 1
    }
    if (period.status === "APPROVED") {
      approvedCount += 1
    }
    if (period.status === "CLOSED") {
      closedCount += 1
    }

    if (period.status !== "DRAFT") {
      totalDistributable = totalDistributable.plus(
        period.distributableAmount ?? new Prisma.Decimal(0)
      )
    }

    if (
      !latestLossFound &&
      (period.status === "APPROVED" || period.status === "CLOSED")
    ) {
      lossCarryforward = period.lossBalanceAfter ?? new Prisma.Decimal(0)
      latestLossFound = true
    }

    let periodPaid = new Prisma.Decimal(0)

    const distributions = period.distributions
      .map((distribution) => {
        const payout = distribution.payouts[0]

        if (payout?.status === "COMPLETED") {
          periodPaid = periodPaid.plus(payout.amount)
        }

        return {
          id: distribution.id,
          shareholderId: distribution.shareholderId,
          shareholderName: distribution.shareholder.name,
          percentage: distribution.percentageSnapshot.toFixed(4),
          amount: distribution.allocatedAmount.toFixed(2),
          status: distribution.status,
          approvedAt: distribution.approvedAt?.toISOString() ?? null,
          payout: payout
            ? {
                id: payout.id,
                amount: payout.amount.toFixed(2),
                status: payout.status,
                paidAt: payout.paidAt?.toISOString() ?? null,
                accountName: payout.account?.name ?? null,
                externalReference: payout.externalReference,
                note: payout.note,
              }
            : null,
        }
      })
      .sort((left, right) =>
        left.shareholderName.localeCompare(right.shareholderName)
      )

    totalPaid = totalPaid.plus(periodPaid)

    return {
      id: period.id,
      month: formatDateOnly(period.startsOn).slice(0, 7),
      startsOn: formatDateOnly(period.startsOn),
      endsOn: formatDateOnly(period.endsOn),
      status: period.status,
      totalRevenue: (period.totalRevenue ?? 0).toFixed(2),
      totalExpenses: (period.totalExpenses ?? 0).toFixed(2),
      providerFees: (period.providerFees ?? 0).toFixed(2),
      reserveAmount: (period.reserveAmount ?? 0).toFixed(2),
      taxAmount: (period.taxAmount ?? 0).toFixed(2),
      netProfit: (period.netProfit ?? 0).toFixed(2),
      lossBalanceBefore: (period.lossBalanceBefore ?? 0).toFixed(2),
      lossApplied: (period.lossApplied ?? 0).toFixed(2),
      lossBalanceAfter: (period.lossBalanceAfter ?? 0).toFixed(2),
      distributableAmount: (period.distributableAmount ?? 0).toFixed(2),
      unallocatedResidual: (period.unallocatedResidual ?? 0).toFixed(2),
      ownershipTotal: (period.ownershipTotal ?? 0).toFixed(4),
      adjustmentNote: period.adjustmentNote,
      calculatedAt: period.calculatedAt?.toISOString() ?? null,
      approvedAt: period.approvedAt?.toISOString() ?? null,
      approvedByName: period.approvedBy?.name ?? null,
      closedAt: period.closedAt?.toISOString() ?? null,
      totalPaid: periodPaid.toFixed(2),
      distributions,
    }
  })

  return {
    periods: mapped,
    accounts,
    currentMonth: currentMonthValue(),
    summary: {
      draftCount,
      approvedCount,
      closedCount,
      totalDistributable: totalDistributable.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      lossCarryforward: lossCarryforward.toFixed(2),
    },
  }
}

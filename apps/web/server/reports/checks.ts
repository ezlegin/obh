import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { ReportRange } from "@/server/reports/range"

export type ConsistencyStatus = "pass" | "warn" | "fail"

export type ConsistencyCheck = {
  id: string
  label: string
  status: ConsistencyStatus
  count: number
  detail: string
}

function check(
  id: string,
  label: string,
  count: number,
  detail: string,
  statusOnIssue: ConsistencyStatus = "fail"
): ConsistencyCheck {
  return {
    id,
    label,
    status: count > 0 ? statusOnIssue : "pass",
    count,
    detail,
  }
}

export async function runConsistencyChecks(
  range: ReportRange
): Promise<ConsistencyCheck[]> {
  const db = getDb()
  const fromDate = new Date(`${range.from}T00:00:00.000Z`)
  const toDate = new Date(`${range.to}T00:00:00.000Z`)

  const [
    completedLivePayments,
    testPayments,
    paidExpenses,
    periods,
    payouts,
    providerAccounts,
    otherCurrencyIncome,
    otherCurrencyExpenses,
  ] = await Promise.all([
    db.payment.findMany({
      where: {
        status: "COMPLETED",
        environment: "LIVE",
        completedAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
      },
      select: {
        id: true,
        reference: true,
        currency: true,
        verifiedAt: true,
        providerAccountId: true,
        providerReference: true,
      },
    }),
    db.payment.count({
      where: {
        status: "COMPLETED",
        environment: "TEST",
        completedAt: {
          gte: range.startInstant,
          lt: range.endInstant,
        },
      },
    }),
    db.expense.findMany({
      where: {
        status: "PAID",
        spentOn: { gte: fromDate, lte: toDate },
      },
      include: {
        category: { select: { name: true, requiresDocument: true } },
        _count: { select: { documents: true } },
      },
    }),
    db.profitPeriod.findMany({
      where: { status: { in: ["APPROVED", "CLOSED"] } },
      include: { distributions: true },
    }),
    db.shareholderPayout.findMany({
      include: {
        profitDistribution: {
          select: {
            allocatedAmount: true,
            status: true,
            profitPeriodId: true,
          },
        },
      },
    }),
    db.financialAccount.findMany({
      where: { kind: "PROVIDER", environment: "LIVE" },
      include: {
        reconciliations: { orderBy: { asOf: "desc" }, take: 1 },
      },
    }),
    db.income.count({
      where: {
        receivedOn: { gte: fromDate, lte: toDate },
        currency: { not: "IRR" },
      },
    }),
    db.expense.count({
      where: {
        spentOn: { gte: fromDate, lte: toDate },
        currency: { not: "IRR" },
      },
    }),
  ])

  const missingVerification = completedLivePayments.filter(
    (payment) => !payment.verifiedAt
  ).length
  const missingProviderAccount = completedLivePayments.filter(
    (payment) => !payment.providerAccountId
  ).length
  const nonIrrPayments = completedLivePayments.filter(
    (payment) => payment.currency !== "IRR"
  ).length

  const providerReferenceCounts = new Map<string, number>()

  for (const payment of completedLivePayments) {
    if (payment.providerReference) {
      providerReferenceCounts.set(
        payment.providerReference,
        (providerReferenceCounts.get(payment.providerReference) ?? 0) + 1
      )
    }
  }

  const duplicateProviderReferences = [
    ...providerReferenceCounts.values(),
  ].filter((count) => count > 1).length

  const missingPaidAt = paidExpenses.filter((expense) => !expense.paidAt).length
  const missingExpenseAccount = paidExpenses.filter(
    (expense) => !expense.accountId
  ).length
  const missingRequiredDocuments = paidExpenses.filter(
    (expense) =>
      expense.category.requiresDocument && expense._count.documents === 0
  ).length

  let allocationMismatch = 0
  let positivePeriodWithoutAllocations = 0
  let closedWithUnpaid = 0
  let missingDistributionApproval = 0
  let invalidOwnershipTotal = 0

  for (const period of periods) {
    const allocated = period.distributions.reduce(
      (sum, distribution) => sum.plus(distribution.allocatedAmount),
      new Prisma.Decimal(0)
    )
    const distributable = period.distributableAmount ?? new Prisma.Decimal(0)
    const residual = period.unallocatedResidual ?? new Prisma.Decimal(0)

    if (!allocated.plus(residual).equals(distributable)) {
      allocationMismatch += 1
    }

    if (distributable.gt(0) && period.distributions.length === 0) {
      positivePeriodWithoutAllocations += 1
    }

    if (
      period.status === "CLOSED" &&
      period.distributions.some(
        (distribution) =>
          distribution.allocatedAmount.gt(0) && distribution.status !== "PAID"
      )
    ) {
      closedWithUnpaid += 1
    }

    if (period.distributions.some((distribution) => !distribution.approvedAt)) {
      missingDistributionApproval += 1
    }

    if (
      distributable.gt(0) &&
      period.ownershipTotal &&
      !period.ownershipTotal.equals(100)
    ) {
      invalidOwnershipTotal += 1
    }
  }

  const payoutMismatch = payouts.filter(
    (payout) => !payout.amount.equals(payout.profitDistribution.allocatedAmount)
  ).length
  const payoutStatusMismatch = payouts.filter(
    (payout) =>
      payout.status === "COMPLETED" &&
      payout.profitDistribution.status !== "PAID"
  ).length
  const accountsWithDifference = providerAccounts.filter(
    (account) =>
      account.reconciliations[0] &&
      !account.reconciliations[0].difference.equals(0)
  ).length

  return [
    check(
      "verified_payments",
      "Completed LIVE payments have verification evidence",
      missingVerification,
      "Completed payments without a verified timestamp."
    ),
    check(
      "provider_accounts",
      "Completed LIVE payments are linked to a provider account",
      missingProviderAccount,
      "Completed payments without a provider account."
    ),
    check(
      "payment_currency",
      "LIVE payments use IRR",
      nonIrrPayments,
      "Completed LIVE payments in another currency."
    ),
    check(
      "provider_references",
      "Provider references are unique",
      duplicateProviderReferences,
      "Repeated provider references among completed LIVE payments.",
      "warn"
    ),
    check(
      "paid_at",
      "Paid expenses have a paid timestamp",
      missingPaidAt,
      "Expenses marked paid without paidAt."
    ),
    check(
      "expense_source",
      "Paid expenses have a payment source",
      missingExpenseAccount,
      "Expenses marked paid without a business source."
    ),
    check(
      "required_documents",
      "Document-required expenses have documents",
      missingRequiredDocuments,
      "Paid expenses whose category requires a document but none is attached."
    ),
    check(
      "allocation_math",
      "Profit allocations plus residual match distributable",
      allocationMismatch,
      "Approved or closed periods with an allocation arithmetic mismatch."
    ),
    check(
      "positive_allocations",
      "Positive distributable periods have allocations",
      positivePeriodWithoutAllocations,
      "Approved or closed profitable periods without shareholder rows."
    ),
    check(
      "closed_unpaid",
      "Closed periods have no unpaid allocations",
      closedWithUnpaid,
      "Closed periods with unpaid positive allocations."
    ),
    check(
      "distribution_approval",
      "Approved allocations carry approval timestamps",
      missingDistributionApproval,
      "Distributions in approved/closed periods without approvedAt."
    ),
    check(
      "ownership_total",
      "Profitable periods snapshot 100% ownership",
      invalidOwnershipTotal,
      "Positive distributable periods whose ownership snapshot is not 100%."
    ),
    check(
      "payout_amount",
      "Full payout amounts equal allocations",
      payoutMismatch,
      "Payout amounts differing from the allocation."
    ),
    check(
      "payout_status",
      "Completed payouts mark allocations paid",
      payoutStatusMismatch,
      "Completed payouts whose distribution is not PAID."
    ),
    check(
      "other_currency",
      "Income and expenses use IRR",
      otherCurrencyIncome + otherCurrencyExpenses,
      "Income or expense records in another currency in this date range."
    ),
    check(
      "reconciliation",
      "Latest provider reconciliations match",
      accountsWithDifference,
      "Provider accounts whose latest reconciliation has a non-zero difference.",
      "warn"
    ),
    check(
      "test_payments",
      "TEST payments are excluded from financial reports",
      testPayments,
      "Completed TEST payments in this range. They are excluded by design.",
      "warn"
    ),
  ]
}

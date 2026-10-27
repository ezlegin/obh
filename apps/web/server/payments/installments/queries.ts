import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import {
  formatDateOnly,
  todayDateOnlyInTehran,
} from "@/server/accounting/dates"
import { settleDueInstallments } from "@/server/payments/installments/installment-service"
import {
  formatPersianDate,
  formatPersianMonth,
} from "@/server/payments/installments/schedule"

export type InstallmentView = {
  id: string
  sequence: number
  amount: string
  dueOn: string
  dueOnPersian: string
  status: "SCHEDULED" | "SETTLED" | "CANCELLED"
  received: boolean
  settledAt: string | null
}

export type InstallmentPlanView = {
  id: string
  paymentId: string
  paymentReference: string
  externalOrderId: string | null
  serviceName: string | null
  gatewayName: string | null
  environment: "TEST" | "LIVE"
  purchaseType: string | null
  status: "ACTIVE" | "SETTLED" | "CANCELLED"
  totalAmount: string
  receivedAmount: string
  outstandingAmount: string
  installmentCount: number
  receivedCount: number
  purchasedOn: string
  purchasedOnPersian: string
  nextDueOn: string | null
  nextDueOnPersian: string | null
  nextAmount: string | null
  installments: InstallmentView[]
}

export type InstallmentTotals = {
  claimed: string
  received: string
  outstanding: string
  activePlans: number
  settledPlans: number
}

export type InstallmentForecastMonth = {
  dueOn: string
  monthLabel: string
  amount: string
  count: number
}

export type InstallmentsWorkspace = {
  today: string
  todayPersian: string
  live: InstallmentTotals
  test: InstallmentTotals
  nextDeposit: { dueOn: string; dueOnPersian: string; amount: string } | null
  forecast: InstallmentForecastMonth[]
  plans: InstallmentPlanView[]
}

function emptyTotals() {
  const zero = new Prisma.Decimal(0)
  return {
    claimed: zero,
    received: zero,
    outstanding: zero,
    activePlans: 0,
    settledPlans: 0,
  }
}

function serializeTotals(totals: ReturnType<typeof emptyTotals>) {
  return {
    claimed: totals.claimed.toFixed(2),
    received: totals.received.toFixed(2),
    outstanding: totals.outstanding.toFixed(2),
    activePlans: totals.activePlans,
    settledPlans: totals.settledPlans,
  }
}

/**
 * Installment purchases with what the gateway has deposited so far and what
 * it still owes. An installment counts as received once its settlement day
 * (Tehran) arrives, matching the provider balance calculation.
 */
export async function getInstallmentsWorkspace(): Promise<InstallmentsWorkspace> {
  await settleDueInstallments()

  const today = todayDateOnlyInTehran()
  const plans = await getDb().installmentPlan.findMany({
    where: { payment: { status: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      installments: { orderBy: { sequence: "asc" } },
      payment: {
        select: {
          id: true,
          reference: true,
          externalOrderId: true,
          environment: true,
          completedAt: true,
          createdAt: true,
          service: { select: { name: true } },
          provider: { select: { name: true } },
        },
      },
    },
  })

  const totals = { LIVE: emptyTotals(), TEST: emptyTotals() }
  const forecast = new Map<string, { amount: Prisma.Decimal; count: number }>()
  const zero = new Prisma.Decimal(0)

  const planViews = plans.map((plan): InstallmentPlanView => {
    const installments = plan.installments.map((installment) => {
      const dueOn = formatDateOnly(installment.dueOn)
      const received =
        installment.status === "SETTLED" ||
        (installment.status === "SCHEDULED" && dueOn <= today)

      return {
        id: installment.id,
        sequence: installment.sequence,
        amount: installment.amount.toFixed(2),
        dueOn,
        dueOnPersian: formatPersianDate(dueOn),
        status: installment.status,
        received,
        settledAt: installment.settledAt?.toISOString() ?? null,
      }
    })

    const receivedAmount = plan.installments.reduce(
      (sum, installment, index) =>
        installments[index]!.received ? sum.plus(installment.amount) : sum,
      zero
    )
    const outstandingAmount = plan.installments.reduce(
      (sum, installment, index) =>
        !installments[index]!.received && installment.status === "SCHEDULED"
          ? sum.plus(installment.amount)
          : sum,
      zero
    )
    const next = installments.find(
      (installment) =>
        !installment.received && installment.status === "SCHEDULED"
    )

    const bucket = totals[plan.payment.environment]
    bucket.claimed = bucket.claimed.plus(plan.totalAmount)
    bucket.received = bucket.received.plus(receivedAmount)
    bucket.outstanding = bucket.outstanding.plus(outstandingAmount)
    if (outstandingAmount.gt(0)) {
      bucket.activePlans += 1
    } else {
      bucket.settledPlans += 1
    }

    if (plan.payment.environment === "LIVE") {
      for (const installment of installments) {
        if (!installment.received && installment.status === "SCHEDULED") {
          const entry = forecast.get(installment.dueOn) ?? {
            amount: zero,
            count: 0,
          }
          forecast.set(installment.dueOn, {
            amount: entry.amount.plus(installment.amount),
            count: entry.count + 1,
          })
        }
      }
    }

    const purchasedOn = todayDateOnlyInTehran(
      plan.payment.completedAt ?? plan.payment.createdAt
    )

    return {
      id: plan.id,
      paymentId: plan.payment.id,
      paymentReference: plan.payment.reference,
      externalOrderId: plan.payment.externalOrderId,
      serviceName: plan.payment.service?.name ?? null,
      gatewayName: plan.payment.provider?.name ?? null,
      environment: plan.payment.environment,
      purchaseType: plan.purchaseType,
      status: plan.status,
      totalAmount: plan.totalAmount.toFixed(2),
      receivedAmount: receivedAmount.toFixed(2),
      outstandingAmount: outstandingAmount.toFixed(2),
      installmentCount: plan.installmentCount,
      receivedCount: installments.filter((installment) => installment.received)
        .length,
      purchasedOn,
      purchasedOnPersian: formatPersianDate(purchasedOn),
      nextDueOn: next?.dueOn ?? null,
      nextDueOnPersian: next?.dueOnPersian ?? null,
      nextAmount: next?.amount ?? null,
      installments,
    }
  })

  const forecastMonths = [...forecast.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dueOn, entry]) => ({
      dueOn,
      monthLabel: formatPersianDate(dueOn),
      amount: entry.amount.toFixed(2),
      count: entry.count,
    }))

  const nextDeposit = forecastMonths[0]

  return {
    today,
    todayPersian: formatPersianDate(today),
    live: serializeTotals(totals.LIVE),
    test: serializeTotals(totals.TEST),
    nextDeposit: nextDeposit
      ? {
          dueOn: nextDeposit.dueOn,
          dueOnPersian: formatPersianDate(nextDeposit.dueOn),
          amount: nextDeposit.amount,
        }
      : null,
    forecast: forecastMonths,
    plans: planViews,
  }
}

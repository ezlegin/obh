import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { todayDateOnlyInTehran } from "@/server/accounting/dates"
import {
  buildInstallmentSchedule,
  DEFAULT_INSTALLMENT_COUNT,
  INSTALLMENT_PURCHASE_TYPES,
} from "@/server/payments/installments/schedule"

type TransactionClient = Prisma.TransactionClient

/**
 * Returns the gateway purchase type when a verified payment settles in
 * installments (Digipay `BNPL` or `CREDIT`), otherwise `null`.
 */
export function installmentPurchaseType(
  verificationMetadata: Record<string, unknown> | null | undefined
) {
  const purchaseType = verificationMetadata?.purchaseType
  return typeof purchaseType === "string" &&
    INSTALLMENT_PURCHASE_TYPES.has(purchaseType)
    ? purchaseType
    : null
}

/**
 * Creates the settlement schedule for a just-completed installment purchase.
 * Installment 1 is settled at once (the customer's checkout payment); the
 * rest are scheduled for the 7th of the following Iranian months. Call inside
 * the transaction that marks the payment COMPLETED.
 */
export async function createInstallmentPlanInTx(
  tx: TransactionClient,
  input: {
    paymentId: string
    amount: Prisma.Decimal
    currency: string
    completedAt: Date
    purchaseType: string
  }
) {
  const purchasedOn = todayDateOnlyInTehran(input.completedAt)
  const schedule = buildInstallmentSchedule({
    totalAmount: input.amount.toFixed(0),
    purchasedOn,
    installmentCount: DEFAULT_INSTALLMENT_COUNT,
  })

  return tx.installmentPlan.create({
    data: {
      paymentId: input.paymentId,
      totalAmount: input.amount,
      installmentCount: schedule.length,
      currency: input.currency,
      purchaseType: input.purchaseType,
      installments: {
        create: schedule.map((item) => ({
          sequence: item.sequence,
          amount: new Prisma.Decimal(item.amount),
          dueOn: new Date(`${item.dueOn}T00:00:00.000Z`),
          status: item.sequence === 1 ? "SETTLED" : "SCHEDULED",
          settledAt: item.sequence === 1 ? input.completedAt : null,
        })),
      },
    },
  })
}

/**
 * Prisma filter for installment amounts the business has not received yet:
 * scheduled installments whose settlement day (Tehran) has not arrived, and
 * installments that were cancelled and will never be deposited.
 */
export function unreceivedInstallmentWhere(
  today = todayDateOnlyInTehran()
): Prisma.InstallmentWhereInput {
  return {
    OR: [
      {
        status: "SCHEDULED",
        dueOn: { gt: new Date(`${today}T00:00:00.000Z`) },
      },
      { status: "CANCELLED" },
    ],
  }
}

/**
 * Sum of installment amounts not yet received for completed payments on one
 * provider account. Subtract it from completed payments to get cash actually
 * received; add it back for the "everything paid in cash" view.
 */
export async function getUnreceivedInstallmentTotal(
  providerAccountId: string,
  currency: string
) {
  const result = await getDb().installment.aggregate({
    where: {
      ...unreceivedInstallmentWhere(),
      plan: {
        currency,
        payment: { providerAccountId, status: "COMPLETED" },
      },
    },
    _sum: { amount: true },
  })

  return result._sum.amount ?? new Prisma.Decimal(0)
}

/**
 * Records installments whose settlement day has arrived as SETTLED and closes
 * plans with nothing left to collect. Balances do not depend on this write —
 * they compare `dueOn` with today — but it keeps statuses and `settledAt`
 * accurate for the installments page and audits.
 */
export async function settleDueInstallments(now = new Date()) {
  const db = getDb()
  const today = new Date(`${todayDateOnlyInTehran(now)}T00:00:00.000Z`)

  const due = await db.installment.findMany({
    where: {
      status: "SCHEDULED",
      dueOn: { lte: today },
      plan: { status: "ACTIVE", payment: { status: "COMPLETED" } },
    },
    select: { id: true, planId: true, dueOn: true },
  })

  if (due.length === 0) {
    return 0
  }

  await db.$transaction(async (tx) => {
    for (const installment of due) {
      await tx.installment.updateMany({
        where: { id: installment.id, status: "SCHEDULED" },
        data: {
          status: "SETTLED",
          // Gateways deposit at the start of the Tehran day.
          settledAt: new Date(
            `${installment.dueOn.toISOString().slice(0, 10)}T00:00:00+03:30`
          ),
        },
      })
    }

    const planIds = [...new Set(due.map((installment) => installment.planId))]
    for (const planId of planIds) {
      const remaining = await tx.installment.count({
        where: { planId, status: "SCHEDULED" },
      })
      if (remaining === 0) {
        await tx.installmentPlan.update({
          where: { id: planId },
          data: { status: "SETTLED" },
        })
      }
    }
  })

  return due.length
}

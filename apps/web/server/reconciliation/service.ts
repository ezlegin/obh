import "server-only"

import { randomBytes } from "node:crypto"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type {
  RecordProviderFeeInput,
  RecordReconciliationInput,
  RecordSettlementInput,
} from "@/lib/validation/reconciliation"
import { DomainError } from "@/server/errors"
import { parseDateOnly } from "@/server/accounting/dates"

export async function calculateProviderBalance(accountId: string) {
  const db = getDb()
  const account = await db.financialAccount.findUnique({
    where: { id: accountId },
    include: { provider: { select: { name: true } } },
  })

  if (!account || account.kind !== "PROVIDER") {
    throw new DomainError(
      "PROVIDER_ACCOUNT_NOT_FOUND",
      "Provider account was not found."
    )
  }

  const [payments, settledFees, pendingFees, transfersOut, transfersIn] =
    await Promise.all([
      db.payment.aggregate({
        where: {
          providerAccountId: account.id,
          status: "COMPLETED",
          currency: account.currency,
        },
        _sum: { amount: true },
      }),
      db.providerFee.aggregate({
        where: {
          providerAccountId: account.id,
          status: "SETTLED",
          currency: account.currency,
        },
        _sum: { amount: true },
      }),
      db.providerFee.aggregate({
        where: {
          providerAccountId: account.id,
          status: "PENDING",
          currency: account.currency,
        },
        _sum: { amount: true },
      }),
      db.transfer.aggregate({
        where: {
          fromAccountId: account.id,
          status: "COMPLETED",
          currency: account.currency,
        },
        _sum: { amount: true },
      }),
      db.transfer.aggregate({
        where: {
          toAccountId: account.id,
          status: "COMPLETED",
          currency: account.currency,
        },
        _sum: { amount: true },
      }),
    ])

  const zero = new Prisma.Decimal(0)
  const paymentsTotal = payments._sum.amount ?? zero
  const fees = settledFees._sum.amount ?? zero
  const pendingFeesTotal = pendingFees._sum.amount ?? zero
  const out = transfersOut._sum.amount ?? zero
  const incoming = transfersIn._sum.amount ?? zero
  const calculated = account.openingBalance
    .plus(paymentsTotal)
    .minus(fees)
    .minus(out)
    .plus(incoming)

  return {
    account,
    openingBalance: account.openingBalance,
    payments: paymentsTotal,
    settledFees: fees,
    pendingFees: pendingFeesTotal,
    transfersOut: out,
    transfersIn: incoming,
    calculatedBalance: calculated,
  }
}

export async function recordProviderFee(
  actorId: string,
  values: RecordProviderFeeInput
) {
  const db = getDb()
  const account = await db.financialAccount.findUnique({
    where: { id: values.providerAccountId },
  })

  if (!account || account.kind !== "PROVIDER") {
    throw new DomainError(
      "PROVIDER_ACCOUNT_NOT_FOUND",
      "Provider account was not found."
    )
  }

  if (values.paymentId) {
    const payment = await db.payment.findUnique({
      where: { id: values.paymentId },
      select: { providerAccountId: true },
    })

    if (!payment || payment.providerAccountId !== account.id) {
      throw new DomainError(
        "PAYMENT_NOT_ON_ACCOUNT",
        "The selected payment does not belong to this provider account."
      )
    }
  }

  const amount = new Prisma.Decimal(values.amount)

  return db.$transaction(async (tx) => {
    const fee = await tx.providerFee.create({
      data: {
        providerAccountId: account.id,
        paymentId: values.paymentId || null,
        kind: values.kind,
        status: "SETTLED",
        amount,
        currency: account.currency,
        chargedAt: parseDateOnly(values.chargedAt),
        reference: values.reference || null,
        note: values.note || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_fee.created",
        entityType: "ProviderFee",
        entityId: fee.id,
        after: {
          accountId: account.id,
          amount: amount.toFixed(2),
          kind: fee.kind,
          status: fee.status,
        },
      },
    })

    return fee
  })
}

export async function recordSettlement(
  actorId: string,
  values: RecordSettlementInput
) {
  const db = getDb()
  const [providerAccount, targetAccount] = await Promise.all([
    db.financialAccount.findUnique({
      where: { id: values.providerAccountId },
    }),
    db.financialAccount.findUnique({ where: { id: values.toAccountId } }),
  ])

  if (!providerAccount || providerAccount.kind !== "PROVIDER") {
    throw new DomainError(
      "PROVIDER_ACCOUNT_NOT_FOUND",
      "Provider account was not found."
    )
  }

  if (!targetAccount || targetAccount.kind !== "BUSINESS") {
    throw new DomainError(
      "TARGET_ACCOUNT_INVALID",
      "Settlement must target a business payment source."
    )
  }

  if (!targetAccount.isActive) {
    throw new DomainError(
      "TARGET_ACCOUNT_INACTIVE",
      "The target business account is inactive."
    )
  }

  if (providerAccount.currency !== targetAccount.currency) {
    throw new DomainError(
      "CURRENCY_MISMATCH",
      "Provider and business accounts must use the same currency."
    )
  }

  const amount = new Prisma.Decimal(values.amount)
  const reference = `STL-${randomBytes(6).toString("hex").toUpperCase()}`

  return db.$transaction(async (tx) => {
    const transfer = await tx.transfer.create({
      data: {
        reference,
        fromAccountId: providerAccount.id,
        toAccountId: targetAccount.id,
        amount,
        currency: providerAccount.currency,
        kind: "SETTLEMENT",
        status: "COMPLETED",
        occurredAt: parseDateOnly(values.occurredAt),
        externalReference: values.externalReference || null,
        note: values.note || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_settlement.completed",
        entityType: "Transfer",
        entityId: transfer.id,
        after: {
          from: providerAccount.id,
          to: targetAccount.id,
          amount: amount.toFixed(2),
          reference,
        },
      },
    })

    return transfer
  })
}

export async function recordReconciliation(
  actorId: string,
  values: RecordReconciliationInput
) {
  const balance = await calculateProviderBalance(values.accountId)
  const actualBalance = new Prisma.Decimal(values.actualBalance)
  const difference = actualBalance.minus(balance.calculatedBalance)

  return getDb().$transaction(async (tx) => {
    const reconciliation = await tx.accountReconciliation.create({
      data: {
        accountId: balance.account.id,
        asOf: parseDateOnly(values.asOf),
        actualBalance,
        calculatedBalance: balance.calculatedBalance,
        difference,
        note: values.note || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_account.reconciled",
        entityType: "AccountReconciliation",
        entityId: reconciliation.id,
        after: {
          accountId: balance.account.id,
          actualBalance: actualBalance.toFixed(2),
          calculatedBalance: balance.calculatedBalance.toFixed(2),
          difference: difference.toFixed(2),
        },
      },
    })

    return reconciliation
  })
}

export async function deleteProviderFee(actorId: string, feeId: string) {
  const db = getDb()
  const fee = await db.providerFee.findUnique({ where: { id: feeId } })
  if (!fee) {
    throw new DomainError("FEE_NOT_FOUND", "Provider fee was not found.")
  }

  return db.$transaction(async (tx) => {
    await tx.providerFee.delete({ where: { id: fee.id } })
    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_fee.deleted",
        entityType: "ProviderFee",
        entityId: fee.id,
        before: {
          accountId: fee.providerAccountId,
          amount: fee.amount.toFixed(2),
          kind: fee.kind,
        },
      },
    })
  })
}

export async function deleteSettlement(actorId: string, transferId: string) {
  const db = getDb()
  const transfer = await db.transfer.findUnique({ where: { id: transferId } })
  if (!transfer) {
    throw new DomainError("SETTLEMENT_NOT_FOUND", "Settlement was not found.")
  }

  return db.$transaction(async (tx) => {
    await tx.transfer.delete({ where: { id: transfer.id } })
    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_settlement.deleted",
        entityType: "Transfer",
        entityId: transfer.id,
        before: {
          reference: transfer.reference,
          amount: transfer.amount.toFixed(2),
        },
      },
    })
  })
}

export async function deleteReconciliation(
  actorId: string,
  reconciliationId: string
) {
  const db = getDb()
  const reconciliation = await db.accountReconciliation.findUnique({
    where: { id: reconciliationId },
  })
  if (!reconciliation) {
    throw new DomainError(
      "RECONCILIATION_NOT_FOUND",
      "Reconciliation record was not found."
    )
  }

  return db.$transaction(async (tx) => {
    await tx.accountReconciliation.delete({ where: { id: reconciliation.id } })
    await tx.auditLog.create({
      data: {
        actorId,
        action: "provider_account.reconciliation_deleted",
        entityType: "AccountReconciliation",
        entityId: reconciliation.id,
        before: {
          accountId: reconciliation.accountId,
          actualBalance: reconciliation.actualBalance.toFixed(2),
          calculatedBalance: reconciliation.calculatedBalance.toFixed(2),
        },
      },
    })
  })
}

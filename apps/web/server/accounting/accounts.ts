import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CreateBusinessAccountInput } from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import { parseDateOnly } from "@/server/accounting/dates"

export async function createBusinessAccount(
  actorId: string,
  values: CreateBusinessAccountInput
) {
  const db = getDb()
  const openingBalance = new Prisma.Decimal(values.openingBalance)

  return db.$transaction(async (tx) => {
    const account = await tx.financialAccount.create({
      data: {
        name: values.name,
        kind: "BUSINESS",
        institution: values.institution || null,
        maskedIdentifier: values.maskedIdentifier || null,
        currency: "IRR",
        openingBalance,
        openingBalanceAt: values.openingBalanceAt
          ? parseDateOnly(values.openingBalanceAt)
          : new Date(),
        notes: values.notes || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "business_account.created",
        entityType: "FinancialAccount",
        entityId: account.id,
        after: {
          name: account.name,
          kind: account.kind,
          openingBalance: openingBalance.toFixed(2),
        },
      },
    })

    return account
  })
}

export async function setBusinessAccountActive(
  actorId: string,
  accountId: string,
  isActive: boolean
) {
  const db = getDb()
  const account = await db.financialAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || account.kind !== "BUSINESS") {
    throw new DomainError(
      "ACCOUNT_NOT_FOUND",
      "Business payment source was not found."
    )
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.financialAccount.update({
      where: { id: account.id },
      data: { isActive },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "business_account.status_changed",
        entityType: "FinancialAccount",
        entityId: account.id,
        before: { isActive: account.isActive },
        after: { isActive: updated.isActive },
      },
    })

    return updated
  })
}

export async function deleteBusinessAccount(
  actorId: string,
  accountId: string
) {
  const db = getDb()
  const account = await db.financialAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || account.kind !== "BUSINESS") {
    throw new DomainError(
      "ACCOUNT_NOT_FOUND",
      "Business payment source was not found."
    )
  }

  return db.$transaction(async (tx) => {
    await tx.expense.updateMany({
      where: { accountId: account.id },
      data: { accountId: null },
    })
    await tx.income.updateMany({
      where: { accountId: account.id },
      data: { accountId: null },
    })
    await tx.recurringExpense.updateMany({
      where: { accountId: account.id },
      data: { accountId: null },
    })
    await tx.accountReconciliation.deleteMany({
      where: { accountId: account.id },
    })
    await tx.capitalContribution.deleteMany({
      where: { accountId: account.id },
    })
    await tx.shareholderPayout.deleteMany({
      where: { accountId: account.id },
    })
    await tx.transfer.deleteMany({
      where: {
        OR: [{ fromAccountId: account.id }, { toAccountId: account.id }],
      },
    })
    await tx.financialAccount.delete({
      where: { id: account.id },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "business_account.deleted",
        entityType: "FinancialAccount",
        entityId: account.id,
        before: {
          name: account.name,
          institution: account.institution,
          openingBalance: account.openingBalance.toFixed(2),
        },
      },
    })
  })
}

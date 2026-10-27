import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CreateIncomeInput } from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import { parseDateOnly } from "@/server/accounting/dates"
import { resolveServiceId } from "@/server/services/resolve-service"

export async function createIncome(actorId: string, values: CreateIncomeInput) {
  const db = getDb()

  if (values.accountId) {
    const account = await db.financialAccount.findUnique({
      where: { id: values.accountId },
    })

    if (!account || account.kind !== "BUSINESS" || !account.isActive) {
      throw new DomainError(
        "ACCOUNT_NOT_FOUND",
        "Select an active business payment source."
      )
    }
  }

  const defaultAccount = !values.accountId
    ? await db.financialAccount.findFirst({
        where: { kind: "BUSINESS", isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    : null
  const resolvedAccountId = values.accountId || defaultAccount?.id || null
  const resolvedServiceId = await resolveServiceId(values.serviceId)

  const amount = new Prisma.Decimal(values.amount)

  return db.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        accountId: resolvedAccountId,
        serviceId: resolvedServiceId,
        amount,
        currency: "IRR",
        receivedOn: parseDateOnly(values.receivedOn),
        description: values.description,
        source: values.source || null,
        externalReference: values.externalReference || null,
        notes: values.notes || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "income.created",
        entityType: "Income",
        entityId: income.id,
        after: {
          amount: amount.toFixed(2),
          source: income.source,
          receivedOn: values.receivedOn,
          accountId: resolvedAccountId,
          serviceId: resolvedServiceId,
        },
      },
    })

    return income
  })
}

export async function deleteIncome(actorId: string, incomeId: string) {
  const db = getDb()
  const income = await db.income.findUnique({
    where: { id: incomeId },
  })

  if (!income) {
    throw new DomainError("INCOME_NOT_FOUND", "Income record was not found.")
  }

  return db.$transaction(async (tx) => {
    await tx.income.delete({ where: { id: income.id } })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "income.deleted",
        entityType: "Income",
        entityId: income.id,
        before: {
          description: income.description,
          amount: income.amount.toFixed(2),
          accountId: income.accountId,
        },
      },
    })
  })
}

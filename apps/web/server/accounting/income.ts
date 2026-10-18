import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CreateIncomeInput } from "@/lib/validation/accounting"
import { DomainError } from "@/server/errors"
import { parseDateOnly } from "@/server/accounting/dates"

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

  const amount = new Prisma.Decimal(values.amount)

  return db.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        accountId: values.accountId || null,
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
        },
      },
    })

    return income
  })
}

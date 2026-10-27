import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type {
  UpdateBusinessAccountInput,
  UpdateExpenseInput,
  UpdateIncomeInput,
  UpdateProviderFeeInput,
  UpdateReconciliationInput,
  UpdateSettlementInput,
} from "@/lib/validation/record-updates"
import { DomainError } from "@/server/errors"
import { parseDateOnly } from "@/server/accounting/dates"
import { calculateProviderBalance } from "@/server/reconciliation/service"
import { resolveServiceId } from "@/server/services/resolve-service"

async function getActiveBusinessAccount(accountId: string) {
  const account = await getDb().financialAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || account.kind !== "BUSINESS") {
    throw new DomainError(
      "ACCOUNT_NOT_FOUND",
      "Business payment source was not found."
    )
  }

  if (!account.isActive) {
    throw new DomainError(
      "ACCOUNT_INACTIVE",
      "The business payment source is inactive."
    )
  }

  return account
}

export async function updateExpense(
  actorId: string,
  values: UpdateExpenseInput
) {
  const db = getDb()
  const expense = await db.expense.findUnique({
    where: { id: values.expenseId },
  })

  if (!expense) {
    throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.")
  }

  const category = await db.expenseCategory.findFirst({
    where: { id: values.categoryId, isActive: true },
    select: { id: true },
  })

  if (!category) {
    throw new DomainError(
      "EXPENSE_CATEGORY_NOT_FOUND",
      "Select an active expense category."
    )
  }

  const account = values.accountId
    ? await getActiveBusinessAccount(values.accountId)
    : null
  const serviceId = await resolveServiceId(values.serviceId)
  const amount = new Prisma.Decimal(values.amount)

  return db.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: {
        categoryId: category.id,
        accountId: account?.id ?? null,
        serviceId,
        amount,
        spentOn: parseDateOnly(values.spentOn),
        description: values.description,
        notes: values.notes || null,
        externalReference: values.externalReference || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "expense.updated",
        entityType: "Expense",
        entityId: expense.id,
        before: {
          categoryId: expense.categoryId,
          accountId: expense.accountId,
          serviceId: expense.serviceId,
          amount: expense.amount.toFixed(2),
          spentOn: expense.spentOn.toISOString().slice(0, 10),
          description: expense.description,
          notes: expense.notes,
          externalReference: expense.externalReference,
        },
        after: {
          categoryId: updated.categoryId,
          accountId: updated.accountId,
          serviceId: updated.serviceId,
          amount: updated.amount.toFixed(2),
          spentOn: updated.spentOn.toISOString().slice(0, 10),
          description: updated.description,
          notes: updated.notes,
          externalReference: updated.externalReference,
        },
      },
    })

    return updated
  })
}

export async function updateIncome(actorId: string, values: UpdateIncomeInput) {
  const db = getDb()
  const income = await db.income.findUnique({
    where: { id: values.incomeId },
  })

  if (!income) {
    throw new DomainError("INCOME_NOT_FOUND", "Income record was not found.")
  }

  const account = values.accountId
    ? await getActiveBusinessAccount(values.accountId)
    : null
  const serviceId = await resolveServiceId(values.serviceId)
  const amount = new Prisma.Decimal(values.amount)

  return db.$transaction(async (tx) => {
    const updated = await tx.income.update({
      where: { id: income.id },
      data: {
        accountId: account?.id ?? null,
        serviceId,
        amount,
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
        action: "income.updated",
        entityType: "Income",
        entityId: income.id,
        before: {
          accountId: income.accountId,
          serviceId: income.serviceId,
          amount: income.amount.toFixed(2),
          receivedOn: income.receivedOn.toISOString().slice(0, 10),
          description: income.description,
          source: income.source,
          externalReference: income.externalReference,
          notes: income.notes,
        },
        after: {
          accountId: updated.accountId,
          serviceId: updated.serviceId,
          amount: updated.amount.toFixed(2),
          receivedOn: updated.receivedOn.toISOString().slice(0, 10),
          description: updated.description,
          source: updated.source,
          externalReference: updated.externalReference,
          notes: updated.notes,
        },
      },
    })

    return updated
  })
}

export async function updateBusinessAccount(
  actorId: string,
  values: UpdateBusinessAccountInput
) {
  const db = getDb()
  const account = await db.financialAccount.findUnique({
    where: { id: values.accountId },
  })

  if (!account || account.kind !== "BUSINESS") {
    throw new DomainError(
      "ACCOUNT_NOT_FOUND",
      "Business payment source was not found."
    )
  }

  const openingBalance = new Prisma.Decimal(values.openingBalance)

  return db.$transaction(async (tx) => {
    const updated = await tx.financialAccount.update({
      where: { id: account.id },
      data: {
        name: values.name,
        institution: values.institution || null,
        maskedIdentifier: values.maskedIdentifier || null,
        openingBalance,
        openingBalanceAt: values.openingBalanceAt
          ? parseDateOnly(values.openingBalanceAt)
          : account.openingBalanceAt,
        notes: values.notes || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "business_account.updated",
        entityType: "FinancialAccount",
        entityId: account.id,
        before: {
          name: account.name,
          institution: account.institution,
          maskedIdentifier: account.maskedIdentifier,
          openingBalance: account.openingBalance.toFixed(2),
          notes: account.notes,
        },
        after: {
          name: updated.name,
          institution: updated.institution,
          maskedIdentifier: updated.maskedIdentifier,
          openingBalance: updated.openingBalance.toFixed(2),
          notes: updated.notes,
        },
      },
    })

    return updated
  })
}

export async function updateProviderFee(
  actorId: string,
  values: UpdateProviderFeeInput
) {
  const db = getDb()
  const fee = await db.providerFee.findUnique({ where: { id: values.feeId } })

  if (!fee) {
    throw new DomainError("FEE_NOT_FOUND", "Provider fee was not found.")
  }

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
    const updated = await tx.providerFee.update({
      where: { id: fee.id },
      data: {
        providerAccountId: account.id,
        paymentId: values.paymentId || null,
        kind: values.kind,
        status: values.status,
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
        action: "provider_fee.updated",
        entityType: "ProviderFee",
        entityId: fee.id,
        before: {
          providerAccountId: fee.providerAccountId,
          paymentId: fee.paymentId,
          kind: fee.kind,
          status: fee.status,
          amount: fee.amount.toFixed(2),
          chargedAt: fee.chargedAt.toISOString().slice(0, 10),
          reference: fee.reference,
          note: fee.note,
        },
        after: {
          providerAccountId: updated.providerAccountId,
          paymentId: updated.paymentId,
          kind: updated.kind,
          status: updated.status,
          amount: updated.amount.toFixed(2),
          chargedAt: updated.chargedAt.toISOString().slice(0, 10),
          reference: updated.reference,
          note: updated.note,
        },
      },
    })

    return updated
  })
}

export async function updateSettlement(
  actorId: string,
  values: UpdateSettlementInput
) {
  const db = getDb()
  const transfer = await db.transfer.findUnique({
    where: { id: values.transferId },
  })

  if (!transfer || transfer.kind !== "SETTLEMENT") {
    throw new DomainError("SETTLEMENT_NOT_FOUND", "Settlement was not found.")
  }

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

  return db.$transaction(async (tx) => {
    const updated = await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        fromAccountId: providerAccount.id,
        toAccountId: targetAccount.id,
        amount,
        currency: providerAccount.currency,
        occurredAt: parseDateOnly(values.occurredAt),
        externalReference: values.externalReference || null,
        note: values.note || null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "settlement.updated",
        entityType: "Transfer",
        entityId: transfer.id,
        before: {
          fromAccountId: transfer.fromAccountId,
          toAccountId: transfer.toAccountId,
          amount: transfer.amount.toFixed(2),
          occurredAt: transfer.occurredAt.toISOString().slice(0, 10),
          externalReference: transfer.externalReference,
          note: transfer.note,
        },
        after: {
          fromAccountId: updated.fromAccountId,
          toAccountId: updated.toAccountId,
          amount: updated.amount.toFixed(2),
          occurredAt: updated.occurredAt.toISOString().slice(0, 10),
          externalReference: updated.externalReference,
          note: updated.note,
        },
      },
    })

    return updated
  })
}

export async function updateReconciliation(
  actorId: string,
  values: UpdateReconciliationInput
) {
  const db = getDb()
  const reconciliation = await db.accountReconciliation.findUnique({
    where: { id: values.reconciliationId },
  })

  if (!reconciliation) {
    throw new DomainError(
      "RECONCILIATION_NOT_FOUND",
      "Reconciliation was not found."
    )
  }

  const balance = await calculateProviderBalance(values.accountId)
  const actualBalance = new Prisma.Decimal(values.actualBalance)
  const difference = actualBalance.minus(balance.calculatedBalance)

  return db.$transaction(async (tx) => {
    const updated = await tx.accountReconciliation.update({
      where: { id: reconciliation.id },
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
        action: "provider_account.reconciliation_updated",
        entityType: "AccountReconciliation",
        entityId: reconciliation.id,
        before: {
          accountId: reconciliation.accountId,
          asOf: reconciliation.asOf.toISOString().slice(0, 10),
          actualBalance: reconciliation.actualBalance.toFixed(2),
          calculatedBalance: reconciliation.calculatedBalance.toFixed(2),
          difference: reconciliation.difference.toFixed(2),
          note: reconciliation.note,
        },
        after: {
          accountId: updated.accountId,
          asOf: updated.asOf.toISOString().slice(0, 10),
          actualBalance: updated.actualBalance.toFixed(2),
          calculatedBalance: updated.calculatedBalance.toFixed(2),
          difference: updated.difference.toFixed(2),
          note: updated.note,
        },
      },
    })

    return updated
  })
}

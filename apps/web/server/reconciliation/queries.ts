import "server-only"

import { getDb } from "@/lib/db/client"
import { calculateProviderBalance } from "@/server/reconciliation/service"

export type ProviderAccountBalanceView = {
  id: string
  name: string
  providerName: string | null
  environment: "TEST" | "LIVE" | null
  currency: string
  isActive: boolean
  openingBalance: string
  payments: string
  settledFees: string
  pendingFees: string
  transfersOut: string
  transfersIn: string
  calculatedBalance: string
  lastReconciliation: {
    id: string
    asOf: string
    actualBalance: string
    calculatedBalance: string
    difference: string
    note: string | null
  } | null
  paymentOptions: Array<{
    id: string
    reference: string
    amount: string
    completedAt: string | null
  }>
}

export type ProviderFeeView = {
  id: string
  providerAccountName: string
  paymentReference: string | null
  kind: "GATEWAY_FEE" | "COMMISSION"
  status: "PENDING" | "SETTLED" | "VOIDED"
  amount: string
  currency: string
  chargedAt: string
  reference: string | null
}

export type SettlementView = {
  id: string
  reference: string
  fromAccountName: string
  toAccountName: string
  amount: string
  currency: string
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED"
  occurredAt: string
  externalReference: string | null
}

export type ReconciliationView = {
  id: string
  accountName: string
  asOf: string
  actualBalance: string
  calculatedBalance: string
  difference: string
  note: string | null
}

export type ReconciliationWorkspace = {
  accounts: ProviderAccountBalanceView[]
  businessAccounts: Array<{ id: string; name: string }>
  fees: ProviderFeeView[]
  transfers: SettlementView[]
  reconciliations: ReconciliationView[]
  summary: {
    providerAccounts: number
    testAccounts: number
    liveAccounts: number
    accountsWithDifference: number
  }
}

export async function getReconciliationWorkspace(): Promise<ReconciliationWorkspace> {
  const db = getDb()
  const accountRows = await db.financialAccount.findMany({
    where: { kind: "PROVIDER" },
    orderBy: [{ environment: "asc" }, { name: "asc" }],
    include: {
      provider: { select: { name: true } },
      reconciliations: {
        orderBy: { asOf: "desc" },
        take: 1,
      },
    },
  })

  const accountIds = accountRows.map((account) => account.id)

  const [
    balances,
    paymentRows,
    feeRows,
    transferRows,
    reconciliationRows,
    businessAccounts,
  ] = await Promise.all([
    Promise.all(
      accountIds.map((accountId) => calculateProviderBalance(accountId))
    ),
    db.payment.findMany({
      where: {
        providerAccountId: { in: accountIds },
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      take: 200,
      select: {
        id: true,
        reference: true,
        amount: true,
        completedAt: true,
        providerAccountId: true,
      },
    }),
    db.providerFee.findMany({
      orderBy: { chargedAt: "desc" },
      take: 100,
      include: {
        providerAccount: { select: { name: true } },
        payment: { select: { reference: true } },
      },
    }),
    db.transfer.findMany({
      where: { kind: "SETTLEMENT" },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
    }),
    db.accountReconciliation.findMany({
      orderBy: { asOf: "desc" },
      take: 100,
      include: { account: { select: { name: true } } },
    }),
    db.financialAccount.findMany({
      where: { kind: "BUSINESS", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const balanceByAccount = new Map(
    balances.map((balance) => [balance.account.id, balance])
  )

  const accounts: ProviderAccountBalanceView[] = accountRows.map((account) => {
    const balance = balanceByAccount.get(account.id)
    const last = account.reconciliations[0]

    return {
      id: account.id,
      name: account.name,
      providerName: account.provider?.name ?? null,
      environment: account.environment,
      currency: account.currency,
      isActive: account.isActive,
      openingBalance: account.openingBalance.toFixed(2),
      payments: (balance?.payments ?? 0).toFixed(2),
      settledFees: (balance?.settledFees ?? 0).toFixed(2),
      pendingFees: (balance?.pendingFees ?? 0).toFixed(2),
      transfersOut: (balance?.transfersOut ?? 0).toFixed(2),
      transfersIn: (balance?.transfersIn ?? 0).toFixed(2),
      calculatedBalance: (balance?.calculatedBalance ?? 0).toFixed(2),
      lastReconciliation: last
        ? {
            id: last.id,
            asOf: last.asOf.toISOString().slice(0, 10),
            actualBalance: last.actualBalance.toFixed(2),
            calculatedBalance: last.calculatedBalance.toFixed(2),
            difference: last.difference.toFixed(2),
            note: last.note,
          }
        : null,
      paymentOptions: paymentRows
        .filter((payment) => payment.providerAccountId === account.id)
        .map((payment) => ({
          id: payment.id,
          reference: payment.reference,
          amount: payment.amount.toFixed(2),
          completedAt: payment.completedAt?.toISOString() ?? null,
        })),
    }
  })

  return {
    accounts,
    businessAccounts,
    fees: feeRows.map((fee) => ({
      id: fee.id,
      providerAccountName: fee.providerAccount.name,
      paymentReference: fee.payment?.reference ?? null,
      kind: fee.kind,
      status: fee.status,
      amount: fee.amount.toFixed(2),
      currency: fee.currency,
      chargedAt: fee.chargedAt.toISOString().slice(0, 10),
      reference: fee.reference,
    })),
    transfers: transferRows.map((transfer) => ({
      id: transfer.id,
      reference: transfer.reference,
      fromAccountName: transfer.fromAccount.name,
      toAccountName: transfer.toAccount.name,
      amount: transfer.amount.toFixed(2),
      currency: transfer.currency,
      status: transfer.status,
      occurredAt: transfer.occurredAt.toISOString().slice(0, 10),
      externalReference: transfer.externalReference,
    })),
    reconciliations: reconciliationRows.map((reconciliation) => ({
      id: reconciliation.id,
      accountName: reconciliation.account.name,
      asOf: reconciliation.asOf.toISOString().slice(0, 10),
      actualBalance: reconciliation.actualBalance.toFixed(2),
      calculatedBalance: reconciliation.calculatedBalance.toFixed(2),
      difference: reconciliation.difference.toFixed(2),
      note: reconciliation.note,
    })),
    summary: {
      providerAccounts: accounts.length,
      testAccounts: accounts.filter((account) => account.environment === "TEST")
        .length,
      liveAccounts: accounts.filter((account) => account.environment === "LIVE")
        .length,
      accountsWithDifference: accounts.filter(
        (account) =>
          account.lastReconciliation &&
          account.lastReconciliation.difference !== "0.00"
      ).length,
    },
  }
}

/**
 * Clearly labeled dashboard sample data. This module must never be used as a
 * substitute for real financial records. Remove it when the live dashboard
 * modules are connected.
 */
export type DevelopmentTransactionStatus = "completed" | "pending" | "failed"

export type DevelopmentTransaction = {
  id: string
  reference: string
  service: string
  description: string
  provider: string
  amount: number
  currency: "IRR"
  status: DevelopmentTransactionStatus
  occurredAt: string
  externalOrderId: string
  verifiedAt: string | null
}

export type DevelopmentAccount = {
  id: string
  name: string
  kind: "Provider account" | "Business account"
  environment: "Test" | "Bank"
  actualBalance: number
  calculatedBalance: number
  pendingAmount: number
}

export const developmentDashboardData = {
  isDevelopment: true,
  summary: {
    totalBalance: 14_820_000_000,
    revenue: 4_260_000_000,
    expenses: 1_740_000_000,
    netProfit: 2_520_000_000,
    periodLabel: "1–18 October 2026",
  },
  cashflow: [
    { label: "11 Oct", revenue: 420_000_000, expenses: 180_000_000 },
    { label: "12 Oct", revenue: 610_000_000, expenses: 240_000_000 },
    { label: "13 Oct", revenue: 380_000_000, expenses: 210_000_000 },
    { label: "14 Oct", revenue: 720_000_000, expenses: 310_000_000 },
    { label: "15 Oct", revenue: 540_000_000, expenses: 190_000_000 },
    { label: "16 Oct", revenue: 880_000_000, expenses: 360_000_000 },
    { label: "17 Oct", revenue: 710_000_000, expenses: 250_000_000 },
  ],
  accounts: [
    {
      id: "account-sadad-live",
      name: "Sadad Live Settlement (Bank Melli)",
      kind: "Provider account",
      environment: "Bank",
      actualBalance: 6_960_000_000,
      calculatedBalance: 6_835_000_000,
      pendingAmount: 120_000_000,
    },
    {
      id: "account-operating",
      name: "OBH Operating Account",
      kind: "Business account",
      environment: "Bank",
      actualBalance: 7_860_000_000,
      calculatedBalance: 7_795_000_000,
      pendingAmount: 0,
    },
  ] satisfies DevelopmentAccount[],
  transactions: [
    {
      id: "demo-payment-1",
      reference: "OBH-91F2A4",
      service: "iGraphical",
      description: "Annual design workspace",
      provider: "Sadad (Bank Melli)",
      amount: 245_000_000,
      currency: "IRR",
      status: "completed",
      occurredAt: "2026-10-17T09:42:00+03:30",
      externalOrderId: "IG-8821",
      verifiedAt: "2026-10-17T09:44:00+03:30",
    },
    {
      id: "demo-payment-2",
      reference: "OBH-73C9B1",
      service: "Pacsaz",
      description: "Team plan renewal",
      provider: "Sadad (Bank Melli)",
      amount: 168_000_000,
      currency: "IRR",
      status: "pending",
      occurredAt: "2026-10-17T11:08:00+03:30",
      externalOrderId: "PZ-4410",
      verifiedAt: null,
    },
    {
      id: "demo-payment-3",
      reference: "OBH-12D7E8",
      service: "Afarin Ai",
      description: "API credits purchase",
      provider: "Sadad (Bank Melli)",
      amount: 92_500_000,
      currency: "IRR",
      status: "completed",
      occurredAt: "2026-10-16T16:21:00+03:30",
      externalOrderId: "AG-2107",
      verifiedAt: "2026-10-16T16:22:00+03:30",
    },
    {
      id: "demo-payment-4",
      reference: "OBH-5A61C3",
      service: "Nour Porcelain",
      description: "Storefront order",
      provider: "Sadad (Bank Melli)",
      amount: 54_800_000,
      currency: "IRR",
      status: "failed",
      occurredAt: "2026-10-16T13:04:00+03:30",
      externalOrderId: "CN-1042",
      verifiedAt: null,
    },
    {
      id: "demo-payment-5",
      reference: "OBH-8B30F9",
      service: "Parallane",
      description: "Project workspace subscription",
      provider: "Sadad (Bank Melli)",
      amount: 310_000_000,
      currency: "IRR",
      status: "completed",
      occurredAt: "2026-10-15T18:37:00+03:30",
      externalOrderId: "PL-7301",
      verifiedAt: "2026-10-15T18:38:00+03:30",
    },
    {
      id: "demo-payment-6",
      reference: "OBH-44E1D7",
      service: "Stucker",
      description: "Production plan upgrade",
      provider: "Sadad (Bank Melli)",
      amount: 128_000_000,
      currency: "IRR",
      status: "pending",
      occurredAt: "2026-10-15T10:12:00+03:30",
      externalOrderId: "ST-3318",
      verifiedAt: null,
    },
    {
      id: "demo-payment-7",
      reference: "OBH-C07A52",
      service: "iGraphical",
      description: "Template marketplace purchase",
      provider: "Sadad (Bank Melli)",
      amount: 76_400_000,
      currency: "IRR",
      status: "completed",
      occurredAt: "2026-10-14T15:49:00+03:30",
      externalOrderId: "IG-8794",
      verifiedAt: "2026-10-14T15:50:00+03:30",
    },
  ] satisfies DevelopmentTransaction[],
  alerts: [
    {
      id: "alert-reconciliation",
      title: "Reconciliation difference",
      description:
        "The sample Sadad settlement actual balance is 125,000,000 IRR above its calculated balance.",
      severity: "warning" as const,
    },
    {
      id: "alert-verification",
      title: "Payments awaiting verification",
      description:
        "Two sample payments remain pending and have no verified provider result.",
      severity: "info" as const,
    },
  ],
} as const

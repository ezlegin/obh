import "server-only"

import { getDb } from "@/lib/db/client"
import { ensurePaymentGateway } from "@/server/gateways/gateway-service"
import { getGatewayCallbackUrl } from "@/server/payments/api-payment-service"
import {
  getMellatConfigStatus,
  MELLAT_PROVIDER_CODE,
  type MellatConfigStatus,
} from "@/server/payments/providers/mellat"

export type AdminMellatGatewayOverview = {
  name: string
  description: string | null
  callbackUrl: string
  config: MellatConfigStatus
  accounts: Array<{
    id: string
    name: string
    environment: "TEST" | "LIVE" | null
    institution: string | null
    paymentCount: number
  }>
  stats: {
    totalPayments: number
    verifiedPayments: number
    failedPayments: number
    pendingPayments: number
  }
}

export async function getMellatGatewayForAdmin(): Promise<AdminMellatGatewayOverview> {
  const { provider } = await ensurePaymentGateway(MELLAT_PROVIDER_CODE)
  const db = getDb()
  const where = { providerId: provider.id }

  const [accounts, total, verified, failed, pending] = await Promise.all([
    db.financialAccount.findMany({
      where: { providerId: provider.id, kind: "PROVIDER" },
      orderBy: { environment: "desc" },
      include: { _count: { select: { payments: true } } },
    }),
    db.payment.count({ where }),
    db.payment.count({ where: { ...where, status: "COMPLETED" } }),
    db.payment.count({ where: { ...where, status: "FAILED" } }),
    db.payment.count({ where: { ...where, status: "PENDING" } }),
  ])

  return {
    name: provider.name,
    description: provider.description,
    callbackUrl: getGatewayCallbackUrl(MELLAT_PROVIDER_CODE),
    config: getMellatConfigStatus(),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      environment: account.environment,
      institution: account.institution,
      paymentCount: account._count.payments,
    })),
    stats: {
      totalPayments: total,
      verifiedPayments: verified,
      failedPayments: failed,
      pendingPayments: pending,
    },
  }
}

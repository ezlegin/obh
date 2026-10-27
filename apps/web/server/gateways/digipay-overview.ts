import "server-only"

import { getDb } from "@/lib/db/client"
import { ensurePaymentGateway } from "@/server/gateways/gateway-service"
import { getGatewayCallbackUrl } from "@/server/payments/api-payment-service"
import {
  DIGIPAY_PROVIDER_CODE,
  getDigipayConfigStatus,
  type DigipayConfigStatus,
} from "@/server/payments/providers/digipay"

export type AdminDigipayGatewayOverview = {
  name: string
  description: string | null
  callbackUrl: string
  config: DigipayConfigStatus
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
    installmentPlans: number
  }
}

export async function getDigipayGatewayForAdmin(): Promise<AdminDigipayGatewayOverview> {
  const { provider } = await ensurePaymentGateway(DIGIPAY_PROVIDER_CODE)
  const db = getDb()
  const where = { providerId: provider.id }

  const [accounts, total, verified, failed, pending, plans] = await Promise.all(
    [
      db.financialAccount.findMany({
        where: { providerId: provider.id, kind: "PROVIDER" },
        orderBy: { environment: "desc" },
        include: { _count: { select: { payments: true } } },
      }),
      db.payment.count({ where }),
      db.payment.count({ where: { ...where, status: "COMPLETED" } }),
      db.payment.count({ where: { ...where, status: "FAILED" } }),
      db.payment.count({ where: { ...where, status: "PENDING" } }),
      db.installmentPlan.count({ where: { payment: where } }),
    ]
  )

  return {
    name: provider.name,
    description: provider.description,
    callbackUrl: getGatewayCallbackUrl(DIGIPAY_PROVIDER_CODE),
    config: getDigipayConfigStatus(),
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
      installmentPlans: plans,
    },
  }
}

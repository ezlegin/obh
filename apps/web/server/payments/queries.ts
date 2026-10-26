import "server-only"

import { getDb } from "@/lib/db/client"
import { ensureSadadGateway } from "@/server/gateways/gateway-service"
import { getSadadCallbackUrl } from "@/server/payments/api-payment-service"
import {
  getSadadConfigStatus,
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
  type SadadConfigStatus,
} from "@/server/payments/providers/sadad"

export type AdminServiceCredential = {
  id: string
  keyId: string
  label: string
  environment: "TEST" | "LIVE"
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type AdminConnectedService = {
  id: string
  name: string
  slug: string
  domain: string
  description: string | null
  allowedReturnUrls: string[]
  defaultReturnUrl: string | null
  webhookUrl: string | null
  webhookSecretConfigured: boolean
  webhookSecretCreatedAt: string | null
  isActive: boolean
  paymentCount: number
  credentials: AdminServiceCredential[]
  createdAt: string
}

export type AdminProviderAccount = {
  id: string
  name: string
  providerId: string | null
  providerName: string | null
  environment: "TEST" | "LIVE" | null
  currency: string
  externalReference: string | null
  isActive: boolean
  paymentCount: number
  createdAt: string
}

export type AdminPaymentProvider = {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  accounts: AdminProviderAccount[]
  paymentCount: number
}

export type AdminSadadGatewayOverview = {
  providerId: string
  code: typeof SADAD_PROVIDER_CODE
  name: typeof SADAD_PROVIDER_NAME
  description: string
  callbackUrl: string
  config: SadadConfigStatus
  accounts: AdminProviderAccount[]
  stats: {
    totalPayments: number
    verifiedPayments: number
    failedPayments: number
    pendingPayments: number
    testPayments: number
    livePayments: number
  }
}

export type AdminPaymentStatus =
  "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "EXPIRED"

export type AdminPayment = {
  id: string
  reference: string
  gatewayOrderId: string
  serviceName: string | null
  serviceDomain: string | null
  externalOrderId: string | null
  amount: string
  currency: string
  environment: "TEST" | "LIVE"
  status: AdminPaymentStatus
  description: string
  providerName: string | null
  providerCode: string | null
  providerAccountName: string | null
  providerReference: string | null
  traceNumber: string | null
  maskedCardNumber: string | null
  gatewayResultCode: number | null
  gatewayResultText: string | null
  paidAt: string | null
  verifiedAt: string | null
  failedAt: string | null
  createdAt: string
  eventCount: number
}

export async function getConnectedServicesForAdmin(): Promise<
  AdminConnectedService[]
> {
  const services = await getDb().connectedService.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      credentials: {
        orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          keyId: true,
          label: true,
          environment: true,
          lastUsedAt: true,
          revokedAt: true,
          createdAt: true,
        },
      },
      _count: {
        select: { payments: true },
      },
    },
  })

  return services.map((service) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
    domain: service.domain,
    description: service.description,
    allowedReturnUrls: service.allowedReturnUrls,
    defaultReturnUrl: service.defaultReturnUrl,
    webhookUrl: service.webhookUrl,
    webhookSecretConfigured: Boolean(service.webhookSecretEncrypted),
    webhookSecretCreatedAt:
      service.webhookSecretCreatedAt?.toISOString() ?? null,
    isActive: service.isActive,
    paymentCount: service._count.payments,
    createdAt: service.createdAt.toISOString(),
    credentials: service.credentials.map((credential) => ({
      id: credential.id,
      keyId: credential.keyId,
      label: credential.label,
      environment: credential.environment,
      lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
      revokedAt: credential.revokedAt?.toISOString() ?? null,
      createdAt: credential.createdAt.toISOString(),
    })),
  }))
}

export async function getSadadGatewayForAdmin(): Promise<AdminSadadGatewayOverview> {
  const { provider } = await ensureSadadGateway()
  const db = getDb()

  const [accounts, total, verified, failed, pending, testCount, liveCount] =
    await Promise.all([
      db.financialAccount.findMany({
        where: { providerId: provider.id, kind: "PROVIDER" },
        orderBy: { environment: "desc" },
        include: {
          provider: { select: { name: true } },
          _count: { select: { payments: true } },
        },
      }),
      db.payment.count({ where: { providerId: provider.id } }),
      db.payment.count({
        where: { providerId: provider.id, status: "COMPLETED" },
      }),
      db.payment.count({
        where: { providerId: provider.id, status: "FAILED" },
      }),
      db.payment.count({
        where: { providerId: provider.id, status: "PENDING" },
      }),
      db.payment.count({
        where: { providerId: provider.id, environment: "TEST" },
      }),
      db.payment.count({
        where: { providerId: provider.id, environment: "LIVE" },
      }),
    ])

  return {
    providerId: provider.id,
    code: SADAD_PROVIDER_CODE,
    name: SADAD_PROVIDER_NAME,
    description:
      provider.description ??
      "Official Sadad (Bank Melli Iran) Internet Payment Gateway.",
    callbackUrl: getSadadCallbackUrl(),
    config: getSadadConfigStatus(),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      providerId: account.providerId,
      providerName: account.provider?.name ?? SADAD_PROVIDER_NAME,
      environment: account.environment,
      currency: account.currency,
      externalReference: account.externalReference,
      isActive: account.isActive,
      paymentCount: account._count.payments,
      createdAt: account.createdAt.toISOString(),
    })),
    stats: {
      totalPayments: total,
      verifiedPayments: verified,
      failedPayments: failed,
      pendingPayments: pending,
      testPayments: testCount,
      livePayments: liveCount,
    },
  }
}

type PaymentRow = Awaited<
  ReturnType<ReturnType<typeof getDb>["payment"]["findMany"]>
>[number]

function mapAdminPayment(
  payment: PaymentRow,
  eventCount: number
): AdminPayment {
  return {
    id: payment.id,
    reference: payment.reference,
    gatewayOrderId: String(payment.gatewayOrderId),
    serviceName: null,
    serviceDomain: null,
    externalOrderId: payment.externalOrderId,
    amount: payment.amount.toFixed(0),
    currency: payment.currency,
    environment: payment.environment,
    status: payment.status,
    description: payment.description,
    providerName: null,
    providerCode: null,
    providerAccountName: null,
    providerReference: payment.providerReference,
    traceNumber: payment.traceNumber,
    maskedCardNumber: payment.maskedCardNumber,
    gatewayResultCode: payment.gatewayResultCode,
    gatewayResultText: payment.gatewayResultText,
    paidAt: payment.completedAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    eventCount,
  }
}

export async function getPaymentsForAdmin(): Promise<AdminPayment[]> {
  await ensureSadadGateway()
  const payments = await getDb().payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      service: { select: { name: true, domain: true } },
      provider: { select: { name: true, code: true } },
      providerAccount: { select: { name: true } },
      _count: { select: { events: true } },
    },
  })

  return payments.map((payment) => {
    const base = mapAdminPayment(payment, payment._count.events)

    return {
      ...base,
      serviceName: payment.service?.name ?? null,
      serviceDomain: payment.service?.domain ?? null,
      providerName: payment.provider?.name ?? SADAD_PROVIDER_NAME,
      providerCode: payment.provider?.code ?? SADAD_PROVIDER_CODE,
      providerAccountName: payment.providerAccount?.name ?? null,
    }
  })
}

export async function getActiveServicesForPayment(): Promise<
  Array<{ id: string; name: string; domain: string }>
> {
  return getDb().connectedService.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, domain: true },
  })
}

import "server-only"

import { getDb } from "@/lib/db/client"

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

export type AdminPaymentStatus =
  "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "EXPIRED"

export type AdminPayment = {
  id: string
  reference: string
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

export async function getPaymentProvidersForAdmin(): Promise<
  AdminPaymentProvider[]
> {
  const providers = await getDb().paymentProvider.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      accounts: {
        where: { kind: "PROVIDER" },
        orderBy: { createdAt: "asc" },
        include: {
          provider: { select: { name: true } },
          _count: { select: { payments: true } },
        },
      },
      _count: { select: { payments: true } },
    },
  })

  return providers.map((provider) => ({
    id: provider.id,
    code: provider.code,
    name: provider.name,
    description: provider.description,
    isActive: provider.isActive,
    paymentCount: provider._count.payments,
    accounts: provider.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      providerId: account.providerId,
      providerName: account.provider?.name ?? null,
      environment: account.environment,
      currency: account.currency,
      externalReference: account.externalReference,
      isActive: account.isActive,
      paymentCount: account._count.payments,
      createdAt: account.createdAt.toISOString(),
    })),
  }))
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
    serviceName: null,
    serviceDomain: null,
    externalOrderId: payment.externalOrderId,
    amount: payment.amount.toFixed(2),
    currency: payment.currency,
    environment: payment.environment,
    status: payment.status,
    description: payment.description,
    providerName: null,
    providerCode: null,
    providerAccountName: null,
    providerReference: payment.providerReference,
    paidAt: payment.completedAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    eventCount,
  }
}

export async function getPaymentsForAdmin(): Promise<AdminPayment[]> {
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
      providerName: payment.provider?.name ?? null,
      providerCode: payment.provider?.code ?? null,
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

export async function getActiveDevelopmentAccountsForPayment(): Promise<
  Array<{ id: string; name: string; providerName: string }>
> {
  const accounts = await getDb().financialAccount.findMany({
    where: {
      kind: "PROVIDER",
      isActive: true,
      environment: "TEST",
      provider: {
        isActive: true,
        code: "development",
      },
    },
    orderBy: { name: "asc" },
    include: {
      provider: { select: { name: true } },
    },
  })

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    providerName: account.provider?.name ?? "Development Gateway",
  }))
}

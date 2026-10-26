import "server-only"

import { randomBytes } from "node:crypto"

import { getDb } from "@/lib/db/client"
import { ensureSadadGateway } from "@/server/gateways/gateway-service"
import { getSadadCallbackUrl } from "@/server/payments/api-payment-service"
import {
  getSadadConfigStatus,
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
  type SadadConfigStatus,
} from "@/server/payments/providers/sadad"
import {
  generateServiceCredential,
  hashServiceSecret,
} from "@/server/payments/service-credentials"
import {
  decryptServiceCredentialSecret,
  decryptWebhookSecret,
  encryptServiceCredentialSecret,
} from "@/server/payments/webhook-secret"

export type AdminServiceCredential = {
  id: string
  keyId: string
  presentedKey: string
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
  webhookSecret: string | null
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

export type AdminPaymentEvent = {
  id: string
  type: string
  source: string
  previousStatus: AdminPaymentStatus | null
  newStatus: AdminPaymentStatus | null
  message: string | null
  createdAt: string
}

export type AdminPaymentVerification = {
  id: string
  status: "PENDING" | "VERIFIED" | "FAILED"
  method: string
  providerReference: string | null
  verifiedAt: string | null
  failureReason: string | null
  createdAt: string
}

export type AdminPayment = {
  id: string
  reference: string
  gatewayOrderId: string
  serviceName: string | null
  serviceDomain: string | null
  externalOrderId: string | null
  idempotencyKey: string | null
  amount: string
  currency: string
  environment: "TEST" | "LIVE"
  status: AdminPaymentStatus
  description: string
  metadata: Record<string, unknown> | null
  providerName: string | null
  providerCode: string | null
  providerAccountName: string | null
  providerReference: string | null
  providerSessionId: string | null
  checkoutUrl: string | null
  returnUrl: string | null
  traceNumber: string | null
  maskedCardNumber: string | null
  gatewayResultCode: number | null
  gatewayResultText: string | null
  callbackReceivedAt: string | null
  paidAt: string | null
  verifiedAt: string | null
  failedAt: string | null
  cancelledAt: string | null
  createdAt: string
  eventCount: number
  events: AdminPaymentEvent[]
  verifications: AdminPaymentVerification[]
}

export async function getConnectedServicesForAdmin(): Promise<
  AdminConnectedService[]
> {
  const db = getDb()
  const services = await db.connectedService.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      credentials: {
        orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          keyId: true,
          secretEncrypted: true,
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

  return Promise.all(
    services.map(async (service) => {
      const activeList = service.credentials.filter((c) => !c.revokedAt)
      let primary = activeList[0] ?? service.credentials[0]

      if (!primary) {
        const generated = generateServiceCredential()
        const secretEncrypted = encryptServiceCredentialSecret(
          generated.presentedKey
        )
        primary = await db.serviceCredential.create({
          data: {
            serviceId: service.id,
            keyId: generated.keyId,
            secretHash: generated.secretHash,
            secretEncrypted,
            label: "API key",
            environment: generated.environment,
          },
          select: {
            id: true,
            keyId: true,
            secretEncrypted: true,
            label: true,
            environment: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        })
      }

      if (service.credentials.length > 1) {
        await db.serviceCredential.deleteMany({
          where: {
            serviceId: service.id,
            id: { not: primary.id },
          },
        })
      }

      let presentedKey = primary.secretEncrypted
        ? decryptServiceCredentialSecret(primary.secretEncrypted)
        : null

      if (!presentedKey) {
        const secret = randomBytes(32).toString("base64url")
        presentedKey = `${primary.keyId}.${secret}`
        await db.serviceCredential.update({
          where: { id: primary.id },
          data: {
            secretHash: hashServiceSecret(secret),
            secretEncrypted: encryptServiceCredentialSecret(presentedKey),
            revokedAt: null,
          },
        })
      }

      const singleCredential: AdminServiceCredential = {
        id: primary.id,
        keyId: primary.keyId,
        presentedKey,
        label: primary.label,
        environment: primary.environment,
        lastUsedAt: primary.lastUsedAt?.toISOString() ?? null,
        revokedAt: null,
        createdAt: primary.createdAt.toISOString(),
      }

      let webhookSecret: string | null = null
      if (service.webhookSecretEncrypted) {
        try {
          webhookSecret = decryptWebhookSecret(service.webhookSecretEncrypted)
        } catch {
          webhookSecret = null
        }
      }

      return {
        id: service.id,
        name: service.name,
        slug: service.slug,
        domain: service.domain,
        description: service.description,
        allowedReturnUrls: service.allowedReturnUrls,
        defaultReturnUrl: service.defaultReturnUrl,
        webhookUrl: service.webhookUrl,
        webhookSecret,
        webhookSecretConfigured: Boolean(service.webhookSecretEncrypted),
        webhookSecretCreatedAt:
          service.webhookSecretCreatedAt?.toISOString() ?? null,
        isActive: service.isActive,
        paymentCount: service._count.payments,
        createdAt: service.createdAt.toISOString(),
        credentials: [singleCredential],
      }
    })
  )
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
  const metadata =
    payment.metadata &&
    typeof payment.metadata === "object" &&
    !Array.isArray(payment.metadata)
      ? (payment.metadata as Record<string, unknown>)
      : null

  return {
    id: payment.id,
    reference: payment.reference,
    gatewayOrderId: String(payment.gatewayOrderId),
    serviceName: null,
    serviceDomain: null,
    externalOrderId: payment.externalOrderId,
    idempotencyKey: payment.idempotencyKey,
    amount: payment.amount.toFixed(0),
    currency: payment.currency,
    environment: payment.environment,
    status: payment.status,
    description: payment.description,
    metadata,
    providerName: null,
    providerCode: null,
    providerAccountName: null,
    providerReference: payment.providerReference,
    providerSessionId: payment.providerSessionId,
    checkoutUrl: payment.checkoutUrl,
    returnUrl: payment.returnUrl,
    traceNumber: payment.traceNumber,
    maskedCardNumber: payment.maskedCardNumber,
    gatewayResultCode: payment.gatewayResultCode,
    gatewayResultText: payment.gatewayResultText,
    callbackReceivedAt: payment.callbackReceivedAt?.toISOString() ?? null,
    paidAt: payment.completedAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    failedAt: payment.failedAt?.toISOString() ?? null,
    cancelledAt: payment.cancelledAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    eventCount,
    events: [],
    verifications: [],
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
      events: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          type: true,
          source: true,
          previousStatus: true,
          newStatus: true,
          message: true,
          createdAt: true,
        },
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          method: true,
          providerReference: true,
          verifiedAt: true,
          failureReason: true,
          createdAt: true,
        },
      },
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
      events: payment.events.map((event) => ({
        id: event.id,
        type: event.type,
        source: event.source,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
      verifications: payment.verifications.map((v) => ({
        id: v.id,
        status: v.status,
        method: v.method,
        providerReference: v.providerReference,
        verifiedAt: v.verifiedAt?.toISOString() ?? null,
        failureReason: v.failureReason,
        createdAt: v.createdAt.toISOString(),
      })),
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

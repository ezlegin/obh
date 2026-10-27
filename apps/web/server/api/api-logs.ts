import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { ApiError } from "@/server/api/errors"
import type { ServiceAuthContext } from "@/server/api/service-auth"
import { DomainError } from "@/server/errors"
import { PaymentProviderError } from "@/server/payments/providers/types"

export type AdminApiLog = {
  id: string
  requestId: string
  method: "POST" | "GET"
  path: string
  statusCode: number
  durationMs: number | null
  serviceId: string
  serviceName: string
  serviceDomain: string
  keyId: string
  paymentReference: string | null
  externalOrderId: string | null
  amount: string | null
  simulator: boolean | null
  idempotencyKey: string | null
  replayed: boolean
  errorCode: string | null
  errorMessage: string | null
  ip: string | null
  userAgent: string | null
  requestBody: Record<string, unknown> | null
  createdAt: string
}

export type RecordAuthenticatedApiCallInput = {
  requestId: string
  request: Request
  auth: ServiceAuthContext
  method: "POST" | "GET"
  path: string
  statusCode: number
  durationMs: number
  paymentReference?: string | null
  externalOrderId?: string | null
  amount?: string | null
  simulator?: boolean | null
  idempotencyKey?: string | null
  replayed?: boolean
  errorCode?: string | null
  errorMessage?: string | null
  requestBody?: Record<string, unknown> | null
}

function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null
  }
  return request.headers.get("x-real-ip")?.trim() || null
}

export function classifyApiErrorForLog(error: unknown): {
  statusCode: number
  errorCode: string
  errorMessage: string
} {
  if (error instanceof ApiError) {
    return {
      statusCode: error.status,
      errorCode: error.code,
      errorMessage: error.message,
    }
  }

  if (error instanceof PaymentProviderError) {
    return {
      statusCode: error.code === "PROVIDER_UNAVAILABLE" ? 503 : 502,
      errorCode: error.code,
      errorMessage: error.message,
    }
  }

  if (error instanceof DomainError) {
    const statusByCode: Record<string, number> = {
      SERVICE_NOT_FOUND: 403,
      SERVICE_INACTIVE: 403,
      PAYMENT_NOT_FOUND: 404,
      ORDER_CONFLICT: 409,
      IDEMPOTENCY_CONFLICT: 409,
      RETURN_URL_REQUIRED: 400,
      RETURN_URL_NOT_ALLOWED: 400,
      PROVIDER_UNAVAILABLE: 503,
    }
    return {
      statusCode: statusByCode[error.code] ?? 400,
      errorCode: error.code,
      errorMessage: error.message,
    }
  }

  return {
    statusCode: 500,
    errorCode: "INTERNAL_ERROR",
    errorMessage: "The request could not be completed.",
  }
}

export async function recordAuthenticatedApiCall(
  input: RecordAuthenticatedApiCallInput
): Promise<void> {
  try {
    const ip = extractClientIp(input.request)
    const userAgent = input.request.headers.get("user-agent")?.trim() || null

    const metadata: Prisma.InputJsonObject = {
      requestId: input.requestId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      serviceId: input.auth.service.id,
      serviceName: input.auth.service.name,
      serviceSlug: input.auth.service.slug,
      serviceDomain: input.auth.service.domain,
      credentialId: input.auth.credentialId,
      keyId: input.auth.keyId,
      paymentReference: input.paymentReference ?? null,
      externalOrderId: input.externalOrderId ?? null,
      amount: input.amount ?? null,
      simulator: input.simulator ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      replayed: Boolean(input.replayed),
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      ip,
      userAgent,
      requestBody: (input.requestBody ?? null) as Prisma.InputJsonValue,
    }

    await getDb().auditLog.create({
      data: {
        action: `${input.method} ${input.path}`,
        entityType: "ServiceApiCall",
        entityId: input.auth.service.id,
        metadata,
      },
    })
  } catch (error) {
    console.error("[OBH API Log] Failed to record API call", error)
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

export async function getApiLogsForAdmin(): Promise<{
  logs: AdminApiLog[]
  services: string[]
}> {
  const db = getDb()

  const [auditRows, historicServiceEvents, connectedServices] =
    await Promise.all([
      db.auditLog.findMany({
        where: { entityType: "ServiceApiCall" },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.paymentEvent.findMany({
        where: { source: "SERVICE" },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          payment: {
            select: {
              id: true,
              reference: true,
              externalOrderId: true,
              idempotencyKey: true,
              amount: true,
              environment: true,
              serviceId: true,
              service: {
                select: {
                  id: true,
                  name: true,
                  domain: true,
                  credentials: {
                    take: 1,
                    select: { keyId: true },
                  },
                },
              },
            },
          },
        },
      }),
      db.connectedService.findMany({
        orderBy: { name: "asc" },
        select: { name: true },
      }),
    ])

  const loggedPaymentRefs = new Set<string>()
  const logs: AdminApiLog[] = []

  for (const row of auditRows) {
    const meta =
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}

    const method = asString(meta.method) === "GET" ? "GET" : "POST"
    const paymentReference = asString(meta.paymentReference)
    if (paymentReference && method === "POST") {
      loggedPaymentRefs.add(paymentReference)
    }

    const requestBody =
      meta.requestBody &&
      typeof meta.requestBody === "object" &&
      !Array.isArray(meta.requestBody)
        ? (meta.requestBody as Record<string, unknown>)
        : null

    logs.push({
      id: row.id,
      requestId: asString(meta.requestId) ?? `req_${row.id.slice(0, 12)}`,
      method,
      path: asString(meta.path) ?? row.action,
      statusCode: asNumber(meta.statusCode) ?? 200,
      durationMs: asNumber(meta.durationMs),
      serviceId: asString(meta.serviceId) ?? row.entityId,
      serviceName: asString(meta.serviceName) ?? "Connected service",
      serviceDomain: asString(meta.serviceDomain) ?? "—",
      keyId: asString(meta.keyId) ?? "svc_...",
      paymentReference,
      externalOrderId: asString(meta.externalOrderId),
      amount: asString(meta.amount),
      simulator: asBoolean(meta.simulator),
      idempotencyKey: asString(meta.idempotencyKey),
      replayed: Boolean(meta.replayed),
      errorCode: asString(meta.errorCode),
      errorMessage: asString(meta.errorMessage),
      ip: asString(meta.ip),
      userAgent: asString(meta.userAgent),
      requestBody,
      createdAt: row.createdAt.toISOString(),
    })
  }

  // Include historic service-originated payment creations that occurred before AuditLog capture
  for (const event of historicServiceEvents) {
    const payment = event.payment
    if (!payment.service || loggedPaymentRefs.has(payment.reference)) {
      continue
    }

    logs.push({
      id: `evt_${event.id}`,
      requestId: `req_${event.id.replace(/-/g, "").slice(0, 24)}`,
      method: "POST",
      path: "/api/v1/payments",
      statusCode: 201,
      durationMs: null,
      serviceId: payment.service.id,
      serviceName: payment.service.name,
      serviceDomain: payment.service.domain,
      keyId: payment.service.credentials[0]?.keyId ?? "svc_...",
      paymentReference: payment.reference,
      externalOrderId: payment.externalOrderId,
      amount: payment.amount.toFixed(0),
      simulator: payment.environment === "TEST",
      idempotencyKey: payment.idempotencyKey,
      replayed: false,
      errorCode: null,
      errorMessage: null,
      ip: null,
      userAgent: "@obhco/payments",
      requestBody: {
        externalOrderId: payment.externalOrderId,
        amount: payment.amount.toFixed(0),
        simulator: payment.environment === "TEST",
      },
      createdAt: event.createdAt.toISOString(),
    })
  }

  logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const serviceNameSet = new Set<string>(
    connectedServices.map((service) => service.name)
  )
  for (const log of logs) {
    if (log.serviceName) {
      serviceNameSet.add(log.serviceName)
    }
  }

  return {
    logs,
    services: [...serviceNameSet].sort((a, b) => a.localeCompare(b)),
  }
}

import "server-only"

import { randomBytes } from "node:crypto"

import { Prisma, type Payment } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CreatePaymentRequest } from "@/lib/validation/payment-api"
import { ApiError } from "@/server/api/errors"
import type { ServiceAuthContext } from "@/server/api/service-auth"
import { getAppBaseUrl } from "@/server/app-url"
import {
  assertPaymentTransition,
  PAYMENT_EVENT_TYPES,
  type PaymentLifecycleStatus,
} from "@/server/payments/lifecycle"
import {
  DEVELOPMENT_PROVIDER_CODE,
  getPaymentProviderAdapter,
} from "@/server/payments/providers/registry"
import { createPaymentRequestFingerprint } from "@/server/payments/request-fingerprint"
import { queuePaymentWebhook } from "@/server/payments/webhook-service"

export type ApiPaymentStatus =
  "pending" | "completed" | "failed" | "cancelled" | "expired"

export type ApiPayment = {
  id: string
  reference: string
  service: string
  externalOrderId: string | null
  amount: string
  currency: string
  environment: "test" | "live"
  status: ApiPaymentStatus
  description: string
  checkoutUrl: string | null
  createdAt: string
  completedAt: string | null
  verifiedAt: string | null
}

function mapStatus(status: PaymentLifecycleStatus): ApiPaymentStatus {
  return status.toLowerCase() as ApiPaymentStatus
}

function mapPayment(payment: Payment, serviceSlug: string): ApiPayment {
  return {
    id: payment.id,
    reference: payment.reference,
    service: serviceSlug,
    externalOrderId: payment.externalOrderId,
    amount: payment.amount.toFixed(2),
    currency: payment.currency,
    environment: payment.environment === "LIVE" ? "live" : "test",
    status: mapStatus(payment.status as PaymentLifecycleStatus),
    description: payment.description,
    checkoutUrl: payment.checkoutUrl,
    createdAt: payment.createdAt.toISOString(),
    completedAt: payment.completedAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
  }
}

function createPaymentReference() {
  return `OBH-${randomBytes(8).toString("hex").toUpperCase()}`
}

function resolveReturnUrl(
  service: ServiceAuthContext["service"],
  requestedReturnUrl: string | undefined
) {
  const returnUrl = requestedReturnUrl ?? service.defaultReturnUrl

  if (!returnUrl) {
    throw new ApiError(
      422,
      "RETURN_URL_REQUIRED",
      "A return URL is required because this service has no default."
    )
  }

  if (!service.allowedReturnUrls.includes(returnUrl)) {
    throw new ApiError(
      422,
      "RETURN_URL_NOT_ALLOWED",
      "The return URL is not in this service's exact allowlist."
    )
  }

  return returnUrl
}

async function findIdempotencyRecord(serviceId: string, key: string) {
  return getDb().paymentIdempotencyRecord.findUnique({
    where: { serviceId_key: { serviceId, key } },
    include: { payment: true },
  })
}

async function ensureIdempotencyRecord(input: {
  serviceId: string
  key: string
  paymentId: string
  fingerprint: string
}) {
  try {
    await getDb().paymentIdempotencyRecord.create({
      data: {
        serviceId: input.serviceId,
        key: input.key,
        paymentId: input.paymentId,
        requestFingerprint: input.fingerprint,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await findIdempotencyRecord(input.serviceId, input.key)

      if (existing && existing.requestFingerprint !== input.fingerprint) {
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This Idempotency-Key was already used for a different request."
        )
      }

      return
    }

    throw error
  }
}

async function findExistingPayment(
  serviceId: string,
  idempotencyKey: string,
  externalOrderId: string
) {
  const db = getDb()
  const byKey = await db.payment.findFirst({
    where: { serviceId, idempotencyKey },
  })

  if (byKey) {
    return { payment: byKey, source: "idempotency" as const }
  }

  const byOrder = await db.payment.findFirst({
    where: { serviceId, externalOrderId },
  })

  if (byOrder) {
    return { payment: byOrder, source: "order" as const }
  }

  return null
}

function assertMatchingFingerprint(
  existing: Payment,
  fingerprint: string,
  source: "idempotency" | "order"
) {
  if (existing.requestFingerprint !== fingerprint) {
    if (source === "idempotency") {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This Idempotency-Key was already used for a different request."
      )
    }

    throw new ApiError(
      409,
      "ORDER_CONFLICT",
      "This external order already exists with different payment details."
    )
  }

  return {
    payment: existing,
    replayed: true,
  }
}

async function replayExistingPayment(
  existing: Payment,
  fingerprint: string,
  source: "idempotency" | "order",
  serviceId: string,
  serviceSlug: string,
  idempotencyKey: string
) {
  const matched = assertMatchingFingerprint(existing, fingerprint, source)

  await ensureIdempotencyRecord({
    serviceId,
    key: idempotencyKey,
    paymentId: matched.payment.id,
    fingerprint,
  })

  return {
    payment: mapPayment(matched.payment, serviceSlug),
    replayed: true,
  }
}

export async function createApiPayment(
  auth: ServiceAuthContext,
  input: CreatePaymentRequest,
  idempotencyKey: string,
  appOrigin: string
): Promise<{ payment: ApiPayment; replayed: boolean }> {
  const db = getDb()
  const amount = new Prisma.Decimal(input.amount)

  if (!amount.isPositive()) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Amount must be greater than zero."
    )
  }

  const returnUrl = resolveReturnUrl(auth.service, input.returnUrl)
  const fingerprint = createPaymentRequestFingerprint({
    externalOrderId: input.externalOrderId,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    returnUrl,
    metadata: input.metadata,
  })

  const idempotencyRecord = await findIdempotencyRecord(
    auth.service.id,
    idempotencyKey
  )

  if (idempotencyRecord) {
    if (idempotencyRecord.requestFingerprint !== fingerprint) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This Idempotency-Key was already used for a different request."
      )
    }

    return {
      payment: mapPayment(idempotencyRecord.payment, auth.service.slug),
      replayed: true,
    }
  }

  const existing = await findExistingPayment(
    auth.service.id,
    idempotencyKey,
    input.externalOrderId
  )

  if (existing) {
    return replayExistingPayment(
      existing.payment,
      fingerprint,
      existing.source,
      auth.service.id,
      auth.service.slug,
      idempotencyKey
    )
  }

  const providerAccount = await db.financialAccount.findFirst({
    where: {
      kind: "PROVIDER",
      isActive: true,
      environment: "TEST",
      provider: {
        isActive: true,
        code: DEVELOPMENT_PROVIDER_CODE,
      },
    },
    orderBy: { createdAt: "asc" },
    include: { provider: true },
  })

  if (!providerAccount?.provider) {
    throw new ApiError(
      503,
      "PROVIDER_UNAVAILABLE",
      "No active TEST payment provider account is available."
    )
  }

  const reference = createPaymentReference()
  let payment: Payment

  try {
    payment = await db.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          reference,
          serviceId: auth.service.id,
          externalOrderId: input.externalOrderId,
          idempotencyKey,
          amount,
          currency: "IRR",
          direction: "INCOMING",
          environment: auth.environment,
          status: "PENDING",
          description: input.description,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          providerId: providerAccount.provider?.id,
          providerAccountId: providerAccount.id,
          returnUrl,
          requestFingerprint: fingerprint,
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: created.id,
          type: PAYMENT_EVENT_TYPES.CREATED,
          source: "SERVICE",
          newStatus: "PENDING",
          message: "Payment initiated by connected service.",
          metadata: { serviceId: auth.service.id },
        },
      })

      await tx.paymentIdempotencyRecord.create({
        data: {
          serviceId: auth.service.id,
          key: idempotencyKey,
          paymentId: created.id,
          requestFingerprint: fingerprint,
        },
      })

      await tx.auditLog.create({
        data: {
          action: "payment.api_created",
          entityType: "Payment",
          entityId: created.id,
          after: {
            reference: created.reference,
            serviceId: auth.service.id,
            environment: auth.environment,
            amount: amount.toFixed(2),
            status: "PENDING",
          },
        },
      })

      return created
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const racedRecord = await findIdempotencyRecord(
        auth.service.id,
        idempotencyKey
      )

      if (racedRecord) {
        if (racedRecord.requestFingerprint !== fingerprint) {
          throw new ApiError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This Idempotency-Key was already used for a different request."
          )
        }

        return {
          payment: mapPayment(racedRecord.payment, auth.service.slug),
          replayed: true,
        }
      }

      const raced = await findExistingPayment(
        auth.service.id,
        idempotencyKey,
        input.externalOrderId
      )

      if (raced) {
        return replayExistingPayment(
          raced.payment,
          fingerprint,
          raced.source,
          auth.service.id,
          auth.service.slug,
          idempotencyKey
        )
      }

      throw new ApiError(
        409,
        "PAYMENT_CONFLICT",
        "A conflicting payment already exists."
      )
    }

    throw error
  }

  try {
    const session = await getPaymentProviderAdapter(
      providerAccount.provider.code
    ).createCheckoutSession({
      paymentReference: payment.reference,
      serviceSlug: auth.service.slug,
      amount: amount.toFixed(2),
      currency: "IRR",
      description: payment.description,
      returnUrl,
      metadata: input.metadata ?? {},
    })

    const checkoutUrl = session.checkoutUrl
      ? new URL(session.checkoutUrl, getAppBaseUrl(appOrigin)).toString()
      : null

    payment = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerSessionId: session.providerSessionId,
          providerReference: session.providerReference,
          checkoutUrl,
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: PAYMENT_EVENT_TYPES.PROVIDER_SESSION_CREATED,
          source: "SYSTEM",
          previousStatus: "PENDING",
          newStatus: "PENDING",
          message: "Provider checkout session created.",
          metadata: { checkoutUrl: checkoutUrl !== null },
        },
      })

      return updated
    })
  } catch (error) {
    const now = new Date()

    await db.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "FAILED", failedAt: now },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: PAYMENT_EVENT_TYPES.FAILED,
          source: "SYSTEM",
          previousStatus: "PENDING",
          newStatus: "FAILED",
          message: "Provider checkout session could not be created.",
          metadata: { simulated: true },
        },
      })
    })

    await queuePaymentWebhook(payment.id).catch((error) => {
      console.error(
        "Webhook notification could not be delivered.",
        error instanceof Error ? error.name : "Unknown error"
      )
    })

    throw new ApiError(
      502,
      "PROVIDER_ERROR",
      "The payment provider could not create a checkout session."
    )
  }

  return {
    payment: mapPayment(payment, auth.service.slug),
    replayed: false,
  }
}

export async function getApiPayment(
  serviceId: string,
  serviceSlug: string,
  reference: string
) {
  const payment = await getDb().payment.findFirst({
    where: { serviceId, reference },
  })

  if (!payment) {
    throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment was not found.")
  }

  return mapPayment(payment, serviceSlug)
}

export type DevelopmentCheckoutView = {
  reference: string
  serviceName: string
  serviceDomain: string
  amount: string
  currency: string
  description: string
  status: PaymentLifecycleStatus
  returnUrl: string | null
  createdAt: string
}

export async function getDevelopmentCheckoutView(
  providerSessionId: string
): Promise<DevelopmentCheckoutView | null> {
  if (!providerSessionId.startsWith("dev_sess_")) {
    return null
  }

  const payment = await getDb().payment.findFirst({
    where: {
      providerSessionId,
      environment: "TEST",
      provider: { code: DEVELOPMENT_PROVIDER_CODE },
    },
    include: {
      service: { select: { name: true, domain: true } },
    },
  })

  if (!payment) {
    return null
  }

  return {
    reference: payment.reference,
    serviceName: payment.service?.name ?? "OBH service",
    serviceDomain: payment.service?.domain ?? "OBH",
    amount: payment.amount.toFixed(2),
    currency: payment.currency,
    description: payment.description,
    status: payment.status as PaymentLifecycleStatus,
    returnUrl: payment.returnUrl,
    createdAt: payment.createdAt.toISOString(),
  }
}

export async function completeDevelopmentCheckout(
  providerSessionId: string,
  outcome: "success" | "failure"
) {
  const db = getDb()
  const payment = await db.payment.findFirst({
    where: {
      providerSessionId,
      environment: "TEST",
      provider: { code: DEVELOPMENT_PROVIDER_CODE },
    },
    include: { provider: true },
  })

  if (!payment) {
    throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment was not found.")
  }

  if (payment.status !== "PENDING") {
    if (payment.status === "COMPLETED" || payment.status === "FAILED") {
      return {
        paymentId: payment.id,
        reference: payment.reference,
        status: payment.status as PaymentLifecycleStatus,
        returnUrl: payment.returnUrl,
      }
    }

    throw new ApiError(
      409,
      "PAYMENT_STATE_CONFLICT",
      "This development checkout can no longer be completed."
    )
  }

  if (!payment.provider) {
    throw new ApiError(503, "PROVIDER_UNAVAILABLE", "Provider is unavailable.")
  }

  const verification = await getPaymentProviderAdapter(
    payment.provider.code
  ).verifyPayment({
    providerSessionId: payment.providerSessionId,
    providerReference: payment.providerReference,
    payload: { outcome },
  })

  if (verification.status === "PENDING") {
    throw new ApiError(
      409,
      "PAYMENT_STATE_CONFLICT",
      "The provider did not return a terminal result."
    )
  }

  const targetStatus: PaymentLifecycleStatus =
    verification.status === "COMPLETED" ? "COMPLETED" : "FAILED"

  assertPaymentTransition(
    payment.status as PaymentLifecycleStatus,
    targetStatus
  )

  const now = verification.verifiedAt ?? new Date()

  const updated = await db.$transaction(async (tx) => {
    const count = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: targetStatus,
        verifiedAt: now,
        completedAt: targetStatus === "COMPLETED" ? now : null,
        failedAt: targetStatus === "FAILED" ? now : null,
      },
    })

    if (count.count !== 1) {
      throw new ApiError(
        409,
        "PAYMENT_STATE_CONFLICT",
        "The payment changed before the result could be recorded."
      )
    }

    await tx.paymentVerification.create({
      data: {
        paymentId: payment.id,
        status: targetStatus === "COMPLETED" ? "VERIFIED" : "FAILED",
        method: "development-checkout/simulated",
        providerReference: verification.providerReference,
        verifiedAt: now,
        failureReason: verification.failureReason,
        metadata: verification.metadata as Prisma.InputJsonValue,
      },
    })

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type:
          targetStatus === "COMPLETED"
            ? PAYMENT_EVENT_TYPES.VERIFIED
            : PAYMENT_EVENT_TYPES.FAILED,
        source: "PROVIDER",
        previousStatus: "PENDING",
        newStatus: targetStatus,
        message:
          targetStatus === "COMPLETED"
            ? "Development checkout reported success."
            : "Development checkout reported failure.",
        metadata: { simulated: true, outcome },
      },
    })

    await tx.auditLog.create({
      data: {
        action: "payment.development_checkout_completed",
        entityType: "Payment",
        entityId: payment.id,
        before: { status: "PENDING" },
        after: {
          status: targetStatus,
          simulated: true,
          environment: "TEST",
        },
      },
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: {
        id: true,
        reference: true,
        status: true,
        returnUrl: true,
      },
    })
  })

  await queuePaymentWebhook(updated.id).catch((error) => {
    console.error(
      "Webhook notification could not be delivered.",
      error instanceof Error ? error.name : "Unknown error"
    )
  })

  return {
    paymentId: updated.id,
    reference: updated.reference,
    status: updated.status as PaymentLifecycleStatus,
    returnUrl: updated.returnUrl,
  }
}

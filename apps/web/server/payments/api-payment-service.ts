import "server-only"

import { randomBytes } from "node:crypto"

import { Prisma, type Payment } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { CreatePaymentRequest } from "@/lib/validation/payment-api"
import { ApiError } from "@/server/api/errors"
import type { ServiceAuthContext } from "@/server/api/service-auth"
import { getAppBaseUrl } from "@/server/app-url"
import { getSadadAccountForEnvironment } from "@/server/gateways/gateway-service"
import {
  assertPaymentTransition,
  PAYMENT_EVENT_TYPES,
  type PaymentLifecycleStatus,
} from "@/server/payments/lifecycle"
import {
  getPaymentProviderAdapter,
  SADAD_PROVIDER_CODE,
} from "@/server/payments/providers/registry"
import { describeSadadCode } from "@/server/payments/providers/sadad"
import { createPaymentRequestFingerprint } from "@/server/payments/request-fingerprint"
import { queuePaymentWebhook } from "@/server/payments/webhook-service"

export type ApiPaymentStatus =
  "pending" | "completed" | "failed" | "cancelled" | "expired"

export type ApiPaymentReceipt = {
  orderNumber: string
  traceNumber: string | null
  referenceNumber: string | null
  maskedCardNumber: string | null
  resultCode: number | null
  resultMessage: string | null
}

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
  receipt: ApiPaymentReceipt
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
    amount: payment.amount.toFixed(0),
    currency: payment.currency,
    environment: payment.environment === "LIVE" ? "live" : "test",
    status: mapStatus(payment.status as PaymentLifecycleStatus),
    description: payment.description,
    checkoutUrl: payment.checkoutUrl,
    receipt: {
      orderNumber: String(payment.gatewayOrderId),
      traceNumber: payment.traceNumber,
      referenceNumber: payment.providerReference,
      maskedCardNumber: payment.maskedCardNumber,
      resultCode: payment.gatewayResultCode,
      resultMessage: payment.gatewayResultText,
    },
    createdAt: payment.createdAt.toISOString(),
    completedAt: payment.completedAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
  }
}

function createPaymentReference() {
  return `OBH-${randomBytes(8).toString("hex").toUpperCase()}`
}

export function getSadadCallbackUrl(appOrigin?: string) {
  return new URL("/api/v1/sadad/callback", getAppBaseUrl(appOrigin)).toString()
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

  if (!/^[1-9]\d{0,17}$/.test(input.amount)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Amount must be a positive whole Rial integer without decimals."
    )
  }

  const amount = new Prisma.Decimal(input.amount)

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

  const { provider, account: providerAccount } =
    await getSadadAccountForEnvironment(auth.environment)

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
          providerId: provider.id,
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
          metadata: {
            serviceId: auth.service.id,
            gatewayOrderId: String(created.gatewayOrderId),
          },
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
            gatewayOrderId: String(created.gatewayOrderId),
            serviceId: auth.service.id,
            environment: auth.environment,
            amount: amount.toFixed(0),
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
      SADAD_PROVIDER_CODE
    ).createCheckoutSession({
      paymentReference: payment.reference,
      gatewayOrderId: String(payment.gatewayOrderId),
      serviceSlug: auth.service.slug,
      amount: amount.toFixed(0),
      currency: "IRR",
      description: payment.description,
      returnUrl,
      callbackUrl: getSadadCallbackUrl(appOrigin),
      environment: auth.environment,
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
          gatewayResultCode: session.resultCode,
          gatewayResultText: session.resultMessage,
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: PAYMENT_EVENT_TYPES.PROVIDER_SESSION_CREATED,
          source: "SYSTEM",
          previousStatus: "PENDING",
          newStatus: "PENDING",
          message: "Sadad PaymentRequest token issued.",
          metadata: {
            checkoutUrl: checkoutUrl !== null,
            simulated: session.simulated,
            resCode: session.resultCode,
          },
        },
      })

      return updated
    })
  } catch (error) {
    const now = new Date()

    await db.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "FAILED",
          failedAt: now,
          gatewayResultText:
            error instanceof Error
              ? error.message
              : "Sadad PaymentRequest failed.",
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: PAYMENT_EVENT_TYPES.FAILED,
          source: "SYSTEM",
          previousStatus: "PENDING",
          newStatus: "FAILED",
          message: "Sadad PaymentRequest could not create a payment token.",
        },
      })
    })

    await queuePaymentWebhook(payment.id).catch((webhookError) => {
      console.error(
        "Webhook notification could not be delivered.",
        webhookError instanceof Error ? webhookError.name : "Unknown error"
      )
    })

    throw new ApiError(
      502,
      "PROVIDER_ERROR",
      "The payment gateway could not create a checkout session."
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
  let payment = await getDb().payment.findFirst({
    where: { serviceId, reference },
  })

  if (!payment) {
    throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment was not found.")
  }

  // If the callback arrived from Sadad with ResCode=0 but Verify previously
  // timed out, retry Verify on read so the service gets the verified outcome.
  if (
    payment.status === "PENDING" &&
    payment.callbackReceivedAt &&
    payment.gatewayResultCode === 0 &&
    payment.providerSessionId
  ) {
    await verifyPendingSadadPayment(payment.id).catch(() => null)
    payment =
      (await getDb().payment.findFirst({
        where: { serviceId, reference },
      })) ?? payment
  }

  return mapPayment(payment, serviceSlug)
}

export type SadadCheckoutView = {
  reference: string
  gatewayOrderId: string
  serviceName: string
  serviceDomain: string
  amount: string
  currency: string
  description: string
  status: PaymentLifecycleStatus
  returnUrl: string | null
  callbackUrl: string
  createdAt: string
}

export async function getSadadSimulatorView(
  token: string
): Promise<SadadCheckoutView | null> {
  if (!token.startsWith("sadad_sim_")) {
    return null
  }

  const payment = await getDb().payment.findFirst({
    where: {
      providerSessionId: token,
      environment: "TEST",
      provider: { code: SADAD_PROVIDER_CODE },
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
    gatewayOrderId: String(payment.gatewayOrderId),
    serviceName: payment.service?.name ?? "OBH service",
    serviceDomain: payment.service?.domain ?? "OBH",
    amount: payment.amount.toFixed(0),
    currency: payment.currency,
    description: payment.description,
    status: payment.status as PaymentLifecycleStatus,
    returnUrl: payment.returnUrl,
    callbackUrl: getSadadCallbackUrl(),
    createdAt: payment.createdAt.toISOString(),
  }
}

export type SadadCallbackPayload = {
  OrderId?: string | null
  Token?: string | null
  ResCode?: string | null
  SwitchResCode?: string | null
  PrimaryAccNo?: string | null
  HashedCardNo?: string | null
  CardHolderFullName?: string | null
}

/**
 * Processes an inbound Sadad HTTP POST callback (`/api/v1/sadad/callback`),
 * correlates it with the stored OBH payment, runs `Verify` when `ResCode = 0`,
 * and returns the redirect target for the customer's browser.
 */
export async function processSadadCallback(input: SadadCallbackPayload) {
  const db = getDb()
  const rawOrderId = input.OrderId?.trim()
  const rawToken = input.Token?.trim()
  const resCode =
    input.ResCode !== undefined &&
    input.ResCode !== null &&
    input.ResCode.trim() !== ""
      ? Number(input.ResCode.trim())
      : -1

  let payment: Payment | null = null

  if (rawToken) {
    payment = await db.payment.findFirst({
      where: { providerSessionId: rawToken },
    })
  }

  if (!payment && rawOrderId && /^\d+$/.test(rawOrderId)) {
    payment = await db.payment.findUnique({
      where: { gatewayOrderId: BigInt(rawOrderId) },
    })
  }

  if (!payment) {
    throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment was not found.")
  }

  if (
    rawOrderId &&
    /^\d+$/.test(rawOrderId) &&
    BigInt(rawOrderId) !== payment.gatewayOrderId
  ) {
    throw new ApiError(
      400,
      "ORDER_MISMATCH",
      "Callback OrderId does not match the payment token."
    )
  }

  // Idempotent return when already finalized
  if (payment.status !== "PENDING") {
    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status as PaymentLifecycleStatus,
      returnUrl: payment.returnUrl,
    }
  }

  const now = new Date()
  const maskedCard = input.PrimaryAccNo?.trim() || payment.maskedCardNumber

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        callbackReceivedAt: payment.callbackReceivedAt ?? now,
        maskedCardNumber: maskedCard ?? null,
        gatewayResultCode: Number.isFinite(resCode) ? resCode : -1,
        gatewayResultText: describeSadadCode(resCode),
      },
    })

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: PAYMENT_EVENT_TYPES.CALLBACK_RECEIVED,
        source: "PROVIDER",
        previousStatus: "PENDING",
        newStatus: "PENDING",
        message: `Sadad callback received (ResCode=${resCode}).`,
        metadata: {
          resCode,
          switchResCode: input.SwitchResCode ?? null,
          maskedCardNumber: maskedCard ?? null,
        },
      },
    })
  })

  // Non-zero ResCode in callback means customer cancelled or payment failed at Sadad
  if (resCode !== 0) {
    const failureText = describeSadadCode(resCode)

    await db.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "FAILED",
          failedAt: now,
          gatewayResultCode: resCode,
          gatewayResultText: failureText,
        },
      })

      if (updated.count === 1) {
        await tx.paymentVerification.create({
          data: {
            paymentId: payment.id,
            status: "FAILED",
            method: "sadad/callback",
            providerReference: payment.providerSessionId,
            verifiedAt: now,
            failureReason: failureText,
            metadata: {
              resCode,
              switchResCode: input.SwitchResCode ?? null,
            },
          },
        })

        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            type: PAYMENT_EVENT_TYPES.FAILED,
            source: "PROVIDER",
            previousStatus: "PENDING",
            newStatus: "FAILED",
            message: failureText,
            metadata: { resCode },
          },
        })
      }
    })

    await queuePaymentWebhook(payment.id).catch((error) => {
      console.error(
        "Webhook notification could not be delivered.",
        error instanceof Error ? error.name : "Unknown error"
      )
    })

    const latest = await db.payment.findUniqueOrThrow({
      where: { id: payment.id },
    })

    return {
      paymentId: latest.id,
      reference: latest.reference,
      status: latest.status as PaymentLifecycleStatus,
      returnUrl: latest.returnUrl,
    }
  }

  return verifyPendingSadadPayment(payment.id, {
    ResCode: 0,
    PrimaryAccNo: maskedCard ?? undefined,
  })
}

export async function verifyPendingSadadPayment(
  paymentId: string,
  callbackPayload?: Record<string, unknown>
) {
  const db = getDb()
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
  })

  if (!payment) {
    throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment was not found.")
  }

  if (payment.status !== "PENDING") {
    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status as PaymentLifecycleStatus,
      returnUrl: payment.returnUrl,
    }
  }

  const verification = await getPaymentProviderAdapter(
    SADAD_PROVIDER_CODE
  ).verifyPayment({
    providerSessionId: payment.providerSessionId,
    providerReference: payment.providerReference,
    gatewayOrderId: String(payment.gatewayOrderId),
    expectedAmount: payment.amount.toFixed(0),
    environment: payment.environment,
    payload: callbackPayload,
  })

  // Network/timeout on Verify: keep PENDING so it can be retried within 15 minutes
  if (verification.status === "PENDING") {
    await db.paymentVerification.create({
      data: {
        paymentId: payment.id,
        status: "PENDING",
        method: "sadad/verify",
        providerReference: verification.providerReference,
        failureReason: verification.resultMessage,
        metadata: verification.metadata as Prisma.InputJsonValue,
      },
    })

    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: "PENDING" as PaymentLifecycleStatus,
      returnUrl: payment.returnUrl,
    }
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
        providerReference: verification.providerReference,
        traceNumber: verification.traceNumber,
        maskedCardNumber:
          verification.maskedCardNumber ?? payment.maskedCardNumber,
        gatewayResultCode: verification.resultCode,
        gatewayResultText: verification.resultMessage,
        verifiedAt: now,
        completedAt: targetStatus === "COMPLETED" ? now : null,
        failedAt: targetStatus === "FAILED" ? now : null,
      },
    })

    if (count.count === 1) {
      await tx.paymentVerification.create({
        data: {
          paymentId: payment.id,
          status: targetStatus === "COMPLETED" ? "VERIFIED" : "FAILED",
          method: "sadad/verify",
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
          message: verification.resultMessage,
          metadata: {
            resCode: verification.resultCode,
            retrievalRefNo: verification.providerReference,
            systemTraceNo: verification.traceNumber,
          },
        },
      })

      await tx.auditLog.create({
        data: {
          action: "payment.sadad_verified",
          entityType: "Payment",
          entityId: payment.id,
          before: { status: "PENDING" },
          after: {
            status: targetStatus,
            environment: payment.environment,
            resCode: verification.resultCode,
            retrievalRefNo: verification.providerReference,
            systemTraceNo: verification.traceNumber,
          },
        },
      })
    }

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

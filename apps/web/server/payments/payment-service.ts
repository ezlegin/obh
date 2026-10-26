import "server-only"

import { randomBytes } from "node:crypto"

import { Prisma, type Payment } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { getAppBaseUrl } from "@/server/app-url"
import type {
  CreateDevelopmentPaymentInputForm,
  SimulateDevelopmentResultInput,
} from "@/lib/validation/payment-platform"
import { DomainError } from "@/server/errors"
import { getSadadAccountForEnvironment } from "@/server/gateways/gateway-service"
import { getSadadCallbackUrl } from "@/server/payments/api-payment-service"
import {
  assertPaymentTransition,
  PAYMENT_EVENT_TYPES,
  type PaymentLifecycleStatus,
} from "@/server/payments/lifecycle"
import {
  getPaymentProviderAdapter,
  SADAD_PROVIDER_CODE,
} from "@/server/payments/providers/registry"
import { queuePaymentWebhook } from "@/server/payments/webhook-service"

export type CreateDevelopmentPaymentInput = {
  actorId: string
  values: CreateDevelopmentPaymentInputForm
  idempotencyKey?: string
}

export type CreatedDevelopmentPayment = {
  paymentId: string
  reference: string
  status: PaymentLifecycleStatus
  idempotent: boolean
}

function createPaymentReference() {
  return `OBH-${randomBytes(8).toString("hex").toUpperCase()}`
}

export async function createDevelopmentPayment(
  input: CreateDevelopmentPaymentInput
): Promise<CreatedDevelopmentPayment> {
  const db = getDb()
  const { values } = input

  if (!/^[1-9]\d{0,17}$/.test(values.amount)) {
    throw new DomainError(
      "INVALID_AMOUNT",
      "Amount must be a positive whole Rial integer without decimals."
    )
  }

  const amount = new Prisma.Decimal(values.amount)

  if (input.idempotencyKey) {
    const existing = await db.payment.findFirst({
      where: {
        serviceId: values.serviceId,
        idempotencyKey: input.idempotencyKey,
      },
      select: {
        id: true,
        reference: true,
        status: true,
      },
    })

    if (existing) {
      return {
        paymentId: existing.id,
        reference: existing.reference,
        status: existing.status as PaymentLifecycleStatus,
        idempotent: true,
      }
    }
  }

  const service = await db.connectedService.findUnique({
    where: { id: values.serviceId },
    select: {
      id: true,
      slug: true,
      isActive: true,
    },
  })

  if (!service?.isActive) {
    throw new DomainError(
      "SERVICE_UNAVAILABLE",
      "Select an active connected service."
    )
  }

  const { provider, account: providerAccount } =
    await getSadadAccountForEnvironment("TEST")

  const existingOrder = await db.payment.findFirst({
    where: {
      serviceId: service.id,
      externalOrderId: values.externalOrderId || undefined,
    },
    select: { id: true },
  })

  if (values.externalOrderId && existingOrder) {
    throw new DomainError(
      "ORDER_CONFLICT",
      "A payment already exists for this external order ID."
    )
  }

  const reference = createPaymentReference()
  const externalOrderId = values.externalOrderId || `TEST-${reference}`

  let payment: Payment
  try {
    payment = await db.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          reference,
          serviceId: service.id,
          externalOrderId,
          amount,
          currency: "IRR",
          direction: "INCOMING",
          environment: "TEST",
          status: "PENDING",
          description: values.description,
          metadata: {
            simulated: true,
            createdBy: "admin",
          },
          providerId: provider.id,
          providerAccountId: providerAccount.id,
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: created.id,
          type: PAYMENT_EVENT_TYPES.CREATED,
          source: "MANAGER",
          newStatus: "PENDING",
          message: "Sadad test payment created from admin console.",
          metadata: {
            simulated: true,
            gatewayOrderId: String(created.gatewayOrderId),
          },
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: "payment.sadad_test_created",
          entityType: "Payment",
          entityId: created.id,
          after: {
            reference: created.reference,
            gatewayOrderId: String(created.gatewayOrderId),
            serviceId: service.id,
            providerAccountId: providerAccount.id,
            amount: amount.toFixed(0),
            status: "PENDING",
            environment: "TEST",
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
      throw new DomainError(
        "PAYMENT_CONFLICT",
        "A payment with this reference or order already exists."
      )
    }

    throw error
  }

  try {
    const adapter = getPaymentProviderAdapter(SADAD_PROVIDER_CODE)
    const session = await adapter.createCheckoutSession({
      paymentReference: payment.reference,
      gatewayOrderId: String(payment.gatewayOrderId),
      serviceSlug: service.slug,
      amount: amount.toFixed(0),
      currency: "IRR",
      description: payment.description,
      returnUrl: null,
      callbackUrl: getSadadCallbackUrl(),
      environment: "TEST",
      metadata: { simulated: true },
    })

    const updated = await db.$transaction(async (tx) => {
      const checkoutUrl = session.checkoutUrl
        ? new URL(session.checkoutUrl, getAppBaseUrl()).toString()
        : null

      const result = await tx.payment.update({
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
          message: "Sadad test session token created.",
          metadata: {
            simulated: session.simulated,
            providerSessionId: session.providerSessionId,
          },
        },
      })

      return result
    })

    payment = updated
  } catch (error) {
    const now = new Date()

    await db.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "FAILED",
          failedAt: now,
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: PAYMENT_EVENT_TYPES.FAILED,
          source: "SYSTEM",
          previousStatus: "PENDING",
          newStatus: "FAILED",
          message: "Sadad test session could not be created.",
          metadata: { simulated: true },
        },
      })
    })

    await queuePaymentWebhook(payment.id).catch((webhookError) => {
      console.error(
        "Webhook notification could not be delivered.",
        webhookError instanceof Error ? webhookError.name : "Unknown error"
      )
    })

    throw new DomainError(
      "PROVIDER_SESSION_FAILED",
      error instanceof Error
        ? error.message
        : "The Sadad test session could not be created."
    )
  }

  return {
    paymentId: payment.id,
    reference: payment.reference,
    status: payment.status as PaymentLifecycleStatus,
    idempotent: false,
  }
}

export async function simulateDevelopmentPaymentResult(
  actorId: string,
  values: SimulateDevelopmentResultInput
) {
  const db = getDb()

  const payment = await db.payment.findUnique({
    where: { id: values.paymentId },
    include: { provider: true },
  })

  if (!payment) {
    throw new DomainError("PAYMENT_NOT_FOUND", "Payment was not found.")
  }

  if (payment.environment !== "TEST") {
    throw new DomainError(
      "LIVE_PAYMENT_PROTECTED",
      "Only TEST environment payments can be simulated."
    )
  }

  if (payment.status !== "PENDING") {
    throw new DomainError(
      "PAYMENT_NOT_PENDING",
      "Only pending payments can receive a first terminal result."
    )
  }

  const adapter = getPaymentProviderAdapter(SADAD_PROVIDER_CODE)
  const verification = await adapter.verifyPayment({
    providerSessionId: payment.providerSessionId,
    providerReference: payment.providerReference,
    gatewayOrderId: String(payment.gatewayOrderId),
    expectedAmount: payment.amount.toFixed(0),
    environment: "TEST",
    payload: { outcome: values.outcome },
  })

  if (verification.status === "PENDING") {
    throw new DomainError(
      "VERIFICATION_PENDING",
      "The Sadad test simulator did not return a terminal result."
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
    const updatedCount = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: targetStatus,
        providerReference: verification.providerReference,
        traceNumber: verification.traceNumber,
        maskedCardNumber: verification.maskedCardNumber,
        gatewayResultCode: verification.resultCode,
        gatewayResultText: verification.resultMessage,
        callbackReceivedAt: now,
        verifiedAt: now,
        completedAt: targetStatus === "COMPLETED" ? now : null,
        failedAt: targetStatus === "FAILED" ? now : null,
      },
    })

    if (updatedCount.count !== 1) {
      throw new DomainError(
        "PAYMENT_NOT_PENDING",
        "The payment changed before the result could be recorded."
      )
    }

    await tx.paymentVerification.create({
      data: {
        paymentId: payment.id,
        status: targetStatus === "COMPLETED" ? "VERIFIED" : "FAILED",
        method: "sadad/simulated",
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
        source: "MANAGER",
        previousStatus: "PENDING",
        newStatus: targetStatus,
        message:
          targetStatus === "COMPLETED"
            ? "Simulated Sadad Verify succeeded."
            : "Simulated Sadad Verify failed.",
        metadata: {
          simulated: true,
          outcome: values.outcome,
          resCode: verification.resultCode,
          retrievalRefNo: verification.providerReference,
          systemTraceNo: verification.traceNumber,
        },
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "payment.sadad_result_simulated",
        entityType: "Payment",
        entityId: payment.id,
        before: { status: "PENDING" },
        after: {
          status: targetStatus,
          simulated: true,
          environment: "TEST",
          resCode: verification.resultCode,
        },
      },
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: {
        service: { select: { name: true, domain: true } },
        provider: { select: { name: true } },
      },
    })
  })

  await queuePaymentWebhook(updated.id).catch((error) => {
    console.error(
      "Webhook notification could not be delivered.",
      error instanceof Error ? error.name : "Unknown error"
    )
  })

  return updated
}

export async function deletePayment(actorId: string, paymentId: string) {
  const db = getDb()
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
  })

  if (!payment) {
    throw new DomainError("PAYMENT_NOT_FOUND", "Payment was not found.")
  }

  return db.$transaction(async (tx) => {
    await tx.providerFee.deleteMany({ where: { paymentId: payment.id } })
    await tx.paymentIdempotencyRecord.deleteMany({
      where: { paymentId: payment.id },
    })
    await tx.webhookDelivery.deleteMany({ where: { paymentId: payment.id } })
    await tx.paymentVerification.deleteMany({
      where: { paymentId: payment.id },
    })
    await tx.paymentEvent.deleteMany({ where: { paymentId: payment.id } })
    await tx.payment.delete({ where: { id: payment.id } })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "payment.deleted",
        entityType: "Payment",
        entityId: payment.id,
        before: {
          reference: payment.reference,
          amount: payment.amount.toFixed(2),
          status: payment.status,
          environment: payment.environment,
        },
      },
    })
  })
}

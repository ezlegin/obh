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
import {
  assertPaymentTransition,
  PAYMENT_EVENT_TYPES,
  type PaymentLifecycleStatus,
} from "@/server/payments/lifecycle"
import {
  DEVELOPMENT_PROVIDER_CODE,
  getPaymentProviderAdapter,
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

  const amount = new Prisma.Decimal(values.amount)

  if (!amount.isPositive()) {
    throw new DomainError("INVALID_AMOUNT", "Amount must be greater than zero.")
  }

  const decimalPlaces = values.amount.split(".")[1]?.length ?? 0

  if (values.amount.includes(".") && decimalPlaces > 2) {
    throw new DomainError(
      "INVALID_AMOUNT",
      "Amount cannot have more than two decimal places."
    )
  }

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

  const providerAccount = await db.financialAccount.findUnique({
    where: { id: values.providerAccountId },
    include: { provider: true },
  })

  if (
    !providerAccount ||
    !providerAccount.isActive ||
    providerAccount.kind !== "PROVIDER" ||
    providerAccount.environment !== "TEST" ||
    !providerAccount.provider?.isActive ||
    providerAccount.provider.code !== DEVELOPMENT_PROVIDER_CODE
  ) {
    throw new DomainError(
      "PROVIDER_UNAVAILABLE",
      "Select an active development provider account."
    )
  }

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
  const externalOrderId = values.externalOrderId || `DEV-${reference}`

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
            development: true,
            createdBy: "admin",
          },
          providerId: providerAccount.provider?.id,
          providerAccountId: providerAccount.id,
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: created.id,
          type: PAYMENT_EVENT_TYPES.CREATED,
          source: "MANAGER",
          newStatus: "PENDING",
          message: "Development payment created for local testing.",
          metadata: { simulated: true },
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: "payment.development_created",
          entityType: "Payment",
          entityId: created.id,
          after: {
            reference: created.reference,
            serviceId: service.id,
            providerAccountId: providerAccount.id,
            amount: amount.toFixed(2),
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
    const adapter = getPaymentProviderAdapter(providerAccount.provider.code)
    const session = await adapter.createCheckoutSession({
      paymentReference: payment.reference,
      serviceSlug: service.slug,
      amount: amount.toFixed(2),
      currency: "IRR",
      description: payment.description,
      returnUrl: null,
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
        },
      })

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: PAYMENT_EVENT_TYPES.PROVIDER_SESSION_CREATED,
          source: "SYSTEM",
          previousStatus: "PENDING",
          newStatus: "PENDING",
          message:
            "Development provider session created. No real provider was contacted.",
          metadata: {
            simulated: true,
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
          message: "Development provider session could not be created.",
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

    throw new DomainError(
      "PROVIDER_SESSION_FAILED",
      error instanceof Error
        ? error.message
        : "The development provider session could not be created."
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

  if (
    payment.environment !== "TEST" ||
    payment.provider?.code !== DEVELOPMENT_PROVIDER_CODE
  ) {
    throw new DomainError(
      "LIVE_PAYMENT_PROTECTED",
      "Only development test payments can be simulated."
    )
  }

  if (payment.status !== "PENDING") {
    throw new DomainError(
      "PAYMENT_NOT_PENDING",
      "Only pending payments can receive a first terminal result."
    )
  }

  const adapter = getPaymentProviderAdapter(payment.provider.code)
  const verification = await adapter.verifyPayment({
    providerSessionId: payment.providerSessionId,
    providerReference: payment.providerReference,
    payload: { outcome: values.outcome },
  })

  if (verification.status === "PENDING") {
    throw new DomainError(
      "VERIFICATION_PENDING",
      "The development adapter did not return a terminal result."
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
        method: "development-adapter/simulated",
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
            ? "Simulated development verification succeeded."
            : "Simulated development verification failed.",
        metadata: {
          simulated: true,
          outcome: values.outcome,
        },
      },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "payment.development_result_simulated",
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

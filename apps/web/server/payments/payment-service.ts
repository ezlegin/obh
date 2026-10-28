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
import { getGatewayAccountForEnvironment } from "@/server/gateways/gateway-service"
import { getGatewayCallbackUrl } from "@/server/payments/api-payment-service"
import {
  createInstallmentPlanInTx,
  installmentPurchaseType,
} from "@/server/payments/installments/installment-service"
import {
  assertPaymentTransition,
  PAYMENT_EVENT_TYPES,
  type PaymentLifecycleStatus,
} from "@/server/payments/lifecycle"
import { normalizeIranianMobile } from "@/server/payments/providers/digipay"
import {
  DEFAULT_PROVIDER_CODE,
  getPaymentProviderAdapter,
  isKnownPaymentProvider,
  providerSupportsEnvironment,
  SADAD_PROVIDER_CODE,
  ZARINPAL_PROVIDER_CODE,
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
  checkoutUrl: string | null
  environment: "TEST" | "LIVE"
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
        checkoutUrl: true,
        environment: true,
      },
    })

    if (existing) {
      return {
        paymentId: existing.id,
        reference: existing.reference,
        status: existing.status as PaymentLifecycleStatus,
        checkoutUrl: existing.checkoutUrl,
        environment: existing.environment,
        idempotent: true,
      }
    }
  }

  const environment: "TEST" | "LIVE" =
    values.environment === "LIVE" ? "LIVE" : "TEST"
  const isSimulated = environment === "TEST"
  const gateway = values.gateway || DEFAULT_PROVIDER_CODE

  if (!isKnownPaymentProvider(gateway)) {
    throw new DomainError(
      "GATEWAY_NOT_SUPPORTED",
      "Select a payment gateway that OBH offers."
    )
  }

  const adapter = getPaymentProviderAdapter(gateway)
  const gatewayName = adapter.descriptor.name

  if (!providerSupportsEnvironment(gateway, environment)) {
    throw new DomainError(
      "LIVE_NOT_AVAILABLE",
      `LIVE ${gatewayName} credentials are not configured on the server.`
    )
  }

  const customerMobile = values.customerMobile
    ? normalizeIranianMobile(values.customerMobile)
    : null

  if (adapter.descriptor.requiresCustomerMobile && !customerMobile) {
    throw new DomainError(
      "CUSTOMER_MOBILE_REQUIRED",
      `${gatewayName} requires the customer's mobile number.`
    )
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
    await getGatewayAccountForEnvironment(gateway, environment)

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
  const externalOrderId =
    values.externalOrderId || `${environment}-${reference}`
  const returnUrl = new URL("/admin/payments", getAppBaseUrl()).toString()

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
          environment,
          status: "PENDING",
          description: values.description,
          returnUrl,
          metadata: {
            simulated: isSimulated,
            createdBy: "admin",
            gateway,
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
          message:
            environment === "LIVE"
              ? `${gatewayName} LIVE payment created from admin console.`
              : `${gatewayName} test payment created from admin console.`,
          metadata: {
            simulated: isSimulated,
            gatewayOrderId: String(created.gatewayOrderId),
          },
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action:
            environment === "LIVE"
              ? `payment.${gateway}_live_created`
              : `payment.${gateway}_test_created`,
          entityType: "Payment",
          entityId: created.id,
          after: {
            reference: created.reference,
            gatewayOrderId: String(created.gatewayOrderId),
            serviceId: service.id,
            providerAccountId: providerAccount.id,
            amount: amount.toFixed(0),
            status: "PENDING",
            environment,
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
    const session = await adapter.createCheckoutSession({
      paymentReference: payment.reference,
      gatewayOrderId: String(payment.gatewayOrderId),
      serviceSlug: service.slug,
      amount: amount.toFixed(0),
      currency: "IRR",
      description: payment.description,
      returnUrl,
      callbackUrl: getGatewayCallbackUrl(gateway),
      environment,
      metadata: { simulated: isSimulated },
      customerMobile,
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
          message:
            environment === "LIVE"
              ? `${gatewayName} LIVE checkout session created.`
              : `${gatewayName} test checkout session created.`,
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
          message:
            environment === "LIVE"
              ? `${gatewayName} LIVE session could not be created.`
              : `${gatewayName} test session could not be created.`,
          metadata: { simulated: isSimulated },
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
        : `The ${gatewayName} session could not be created.`
    )
  }

  return {
    paymentId: payment.id,
    reference: payment.reference,
    status: payment.status as PaymentLifecycleStatus,
    checkoutUrl: payment.checkoutUrl,
    environment,
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

  const gateway = payment.provider?.code ?? SADAD_PROVIDER_CODE
  const adapter = getPaymentProviderAdapter(gateway)
  const verification = await adapter.verifyPayment({
    providerSessionId: payment.providerSessionId,
    providerReference: payment.providerReference,
    gatewayOrderId: String(payment.gatewayOrderId),
    expectedAmount: payment.amount.toFixed(0),
    environment: "TEST",
    payload:
      gateway === SADAD_PROVIDER_CODE
        ? { outcome: values.outcome }
        : gateway === ZARINPAL_PROVIDER_CODE
          ? {
              Authority: payment.providerSessionId,
              Status: values.outcome === "success" ? "OK" : "NOK",
            }
          : {
            result: values.outcome === "success" ? "SUCCESS" : "FAILURE",
            trackingCode: `sim_${payment.reference}`,
            providerId: String(payment.gatewayOrderId),
            amount: payment.amount.toFixed(0),
            type: 13,
          },
  })

  if (verification.status === "PENDING") {
    throw new DomainError(
      "VERIFICATION_PENDING",
      "The test simulator did not return a terminal result."
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
        method: `${gateway}/simulated`,
        providerReference: verification.providerReference,
        verifiedAt: now,
        failureReason: verification.failureReason,
        metadata: verification.metadata as Prisma.InputJsonValue,
      },
    })

    const purchaseType = installmentPurchaseType(verification.metadata)
    if (targetStatus === "COMPLETED" && purchaseType) {
      await createInstallmentPlanInTx(tx, {
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        completedAt: now,
        purchaseType,
      })
    }

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
            ? `Simulated ${gateway} verify succeeded.`
            : `Simulated ${gateway} verify failed.`,
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
        action: `payment.${gateway}_result_simulated`,
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

/**
 * Deletes every TEST (simulator) payment and its dependent records. LIVE
 * payments are never touched.
 */
export async function deleteAllTestPayments(actorId: string) {
  const db = getDb()

  return db.$transaction(async (tx) => {
    const payments = await tx.payment.findMany({
      where: { environment: "TEST" },
      select: { id: true },
    })
    const paymentIds = payments.map((payment) => payment.id)

    if (paymentIds.length === 0) {
      return { deleted: 0 }
    }

    const byPayment = { paymentId: { in: paymentIds } }
    await tx.providerFee.deleteMany({ where: byPayment })
    await tx.paymentIdempotencyRecord.deleteMany({ where: byPayment })
    await tx.webhookDelivery.deleteMany({ where: byPayment })
    await tx.paymentVerification.deleteMany({ where: byPayment })
    await tx.paymentEvent.deleteMany({ where: byPayment })
    await tx.installmentPlan.deleteMany({ where: byPayment })
    const deleted = await tx.payment.deleteMany({
      where: { id: { in: paymentIds }, environment: "TEST" },
    })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "payment.test_payments_deleted",
        entityType: "Payment",
        entityId: "TEST",
        after: { deleted: deleted.count, environment: "TEST" },
      },
    })

    return { deleted: deleted.count }
  })
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
    // Installments cascade from their plan.
    await tx.installmentPlan.deleteMany({ where: { paymentId: payment.id } })
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

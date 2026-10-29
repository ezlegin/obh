import "server-only"

import { randomBytes } from "node:crypto"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import type { PaymentSnapshotInput } from "@/lib/validation/finance-events"
import { ApiError } from "@/server/api/errors"
import type { ServiceAuthContext } from "@/server/api/service-auth"
import {
  ensureServiceProviderAccount,
  isKnownGateway,
} from "@/server/finance/provider-accounts"
import {
  createInstallmentPlanInTx,
} from "@/server/payments/installments/installment-service"
import {
  assertPaymentTransition,
  InvalidPaymentTransitionError,
  PAYMENT_EVENT_TYPES,
  type PaymentLifecycleStatus,
} from "@/server/payments/lifecycle"

type PaymentRow = Prisma.PaymentGetPayload<object>

const STATUS: Record<
  PaymentSnapshotInput["status"],
  PaymentLifecycleStatus
> = {
  pending: "PENDING",
  completed: "COMPLETED",
  failed: "FAILED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
}

const EVENT_BY_STATUS: Partial<Record<PaymentLifecycleStatus, string>> = {
  COMPLETED: PAYMENT_EVENT_TYPES.VERIFIED,
  FAILED: PAYMENT_EVENT_TYPES.FAILED,
  CANCELLED: PAYMENT_EVENT_TYPES.CANCELLED,
  EXPIRED: PAYMENT_EVENT_TYPES.EXPIRED,
}

export type IngestResult = {
  reference: string
  status: PaymentLifecycleStatus
  created: boolean
  changed: boolean
}

function externalOrderIdFor(snapshot: PaymentSnapshotInput) {
  // Failed attempts on one order must not collide on the unique
  // (service, externalOrderId) pair, so retries get a suffix.
  return snapshot.attempt === 1
    ? snapshot.orderId
    : `${snapshot.orderId}~${snapshot.attempt}`
}

function newReference() {
  return `OBH-${randomBytes(8).toString("hex").toUpperCase()}`
}

function toDate(value: string | null) {
  return value ? new Date(value) : null
}

function mutableFields(snapshot: PaymentSnapshotInput) {
  const status = STATUS[snapshot.status]

  return {
    status,
    providerReference: snapshot.providerReference,
    traceNumber: snapshot.traceNumber,
    maskedCardNumber: snapshot.maskedCardNumber,
    gatewayResultCode: snapshot.resultCode,
    gatewayResultText: snapshot.resultText,
    callbackReceivedAt: toDate(snapshot.callbackReceivedAt),
    completedAt: toDate(snapshot.completedAt),
    verifiedAt: status === "COMPLETED" ? toDate(snapshot.completedAt) : null,
    failedAt: toDate(snapshot.failedAt),
  }
}

/**
 * Upserts one payment attempt reported by a connected service. The service
 * already verified the payment with its own bank terminal; OBH records it so
 * accounting, settlement and installment tracking stay in one place.
 *
 * The snapshot is the full state, so replays are harmless: an identical
 * snapshot changes nothing, a later status moves a pending payment forward,
 * and a conflicting report for an already-final payment is rejected.
 */
export async function ingestPaymentSnapshot(
  auth: ServiceAuthContext,
  snapshot: PaymentSnapshotInput
): Promise<IngestResult> {
  if (!isKnownGateway(snapshot.gateway)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `Unknown gateway "${snapshot.gateway}".`
    )
  }

  const db = getDb()
  const environment = snapshot.environment === "live" ? "LIVE" : "TEST"
  const { provider, account } = await ensureServiceProviderAccount({
    serviceId: auth.service.id,
    serviceName: auth.service.name,
    gateway: snapshot.gateway,
    environment,
  })

  const run = () =>
    db.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: {
          serviceId_serviceReference: {
            serviceId: auth.service.id,
            serviceReference: snapshot.reference,
          },
        },
      })

      if (!existing) {
        return createFromSnapshot(tx, auth, snapshot, {
          providerId: provider.id,
          providerAccountId: account.id,
          environment,
        })
      }

      return updateFromSnapshot(tx, auth, snapshot, existing)
    })

  try {
    return await run()
  } catch (error) {
    // Two reports for a new payment can race on the unique constraint; the
    // second one then takes the update path.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return run()
    }
    throw error
  }
}

async function createFromSnapshot(
  tx: Prisma.TransactionClient,
  auth: ServiceAuthContext,
  snapshot: PaymentSnapshotInput,
  context: {
    providerId: string
    providerAccountId: string
    environment: "TEST" | "LIVE"
  }
): Promise<IngestResult> {
  const fields = mutableFields(snapshot)

  const created = await tx.payment.create({
    data: {
      reference: newReference(),
      serviceId: auth.service.id,
      serviceReference: snapshot.reference,
      externalOrderId: externalOrderIdFor(snapshot),
      amount: new Prisma.Decimal(snapshot.amount),
      currency: snapshot.currency,
      description: snapshot.description,
      environment: context.environment,
      providerId: context.providerId,
      providerAccountId: context.providerAccountId,
      providerSessionId: null,
      metadata: {
        source: "reported",
        orderId: snapshot.orderId,
        attempt: snapshot.attempt,
        gateway: snapshot.gateway,
        serviceGatewayOrderId: snapshot.gatewayOrderId,
        ...(snapshot.metadata ?? {}),
      } as Prisma.InputJsonObject,
      createdAt: new Date(snapshot.createdAt),
      ...fields,
    },
  })

  await tx.paymentEvent.create({
    data: {
      paymentId: created.id,
      type: PAYMENT_EVENT_TYPES.CREATED,
      source: "SERVICE",
      newStatus: "PENDING",
      message: `Reported by ${auth.service.name} (${snapshot.gateway}).`,
      createdAt: new Date(snapshot.createdAt),
    },
  })

  if (fields.status !== "PENDING") {
    await recordTransition(tx, created, snapshot, "PENDING")
  }

  return {
    reference: created.reference,
    status: created.status as PaymentLifecycleStatus,
    created: true,
    changed: true,
  }
}

async function updateFromSnapshot(
  tx: Prisma.TransactionClient,
  auth: ServiceAuthContext,
  snapshot: PaymentSnapshotInput,
  existing: PaymentRow
): Promise<IngestResult> {
  if (existing.amount.toFixed(0) !== snapshot.amount) {
    throw new ApiError(
      409,
      "AMOUNT_CONFLICT",
      "A payment with this reference was already reported with a different amount."
    )
  }

  const from = existing.status as PaymentLifecycleStatus
  const to = STATUS[snapshot.status]

  if (from === to) {
    // Same status: refresh late-arriving details, never regress.
    const fields = mutableFields(snapshot)
    const changed =
      (existing.callbackReceivedAt === null &&
        fields.callbackReceivedAt !== null) ||
      (existing.providerReference === null && fields.providerReference !== null)

    if (changed && from === "PENDING") {
      await tx.payment.update({
        where: { id: existing.id },
        data: {
          providerReference: fields.providerReference,
          gatewayResultCode: fields.gatewayResultCode,
          gatewayResultText: fields.gatewayResultText,
          callbackReceivedAt: fields.callbackReceivedAt,
        },
      })
    }

    return {
      reference: existing.reference,
      status: from,
      created: false,
      changed,
    }
  }

  try {
    assertPaymentTransition(from, to)
  } catch (error) {
    if (error instanceof InvalidPaymentTransitionError) {
      throw new ApiError(
        409,
        "STATE_CONFLICT",
        `Payment is already ${from.toLowerCase()} and cannot become ${to.toLowerCase()}.`
      )
    }
    throw error
  }

  const updated = await tx.payment.update({
    where: { id: existing.id },
    data: mutableFields(snapshot),
  })

  await recordTransition(tx, updated, snapshot, from)

  return {
    reference: updated.reference,
    status: to,
    created: false,
    changed: true,
  }
}

async function recordTransition(
  tx: Prisma.TransactionClient,
  payment: PaymentRow,
  snapshot: PaymentSnapshotInput,
  previous: PaymentLifecycleStatus
) {
  const status = payment.status as PaymentLifecycleStatus
  const at =
    toDate(snapshot.completedAt) ??
    toDate(snapshot.failedAt) ??
    new Date(snapshot.createdAt)

  await tx.paymentVerification.create({
    data: {
      paymentId: payment.id,
      status: status === "COMPLETED" ? "VERIFIED" : "FAILED",
      method: `${snapshot.gateway}/reported`,
      providerReference: snapshot.providerReference,
      verifiedAt: at,
      failureReason: status === "COMPLETED" ? null : snapshot.resultText,
      metadata: {
        source: "service_report",
        resultCode: snapshot.resultCode,
      },
    },
  })

  if (status === "COMPLETED" && snapshot.installment) {
    await createInstallmentPlanInTx(tx, {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      completedAt: at,
      purchaseType: snapshot.installment.purchaseType,
    })
  }

  await tx.paymentEvent.create({
    data: {
      paymentId: payment.id,
      type: EVENT_BY_STATUS[status] ?? PAYMENT_EVENT_TYPES.FAILED,
      source: "SERVICE",
      previousStatus: previous,
      newStatus: status,
      message: snapshot.resultText,
      metadata: {
        gateway: snapshot.gateway,
        resCode: snapshot.resultCode,
        retrievalRefNo: snapshot.providerReference,
        systemTraceNo: snapshot.traceNumber,
      },
      createdAt: at,
    },
  })

  await tx.auditLog.create({
    data: {
      action: `payment.${snapshot.gateway}_reported`,
      entityType: "Payment",
      entityId: payment.id,
      before: { status: previous },
      after: {
        status,
        environment: payment.environment,
        gateway: snapshot.gateway,
        resCode: snapshot.resultCode,
        retrievalRefNo: snapshot.providerReference,
        systemTraceNo: snapshot.traceNumber,
      },
    },
  })
}

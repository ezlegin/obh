import "server-only"

import { getDb } from "@/lib/db/client"
import { DomainError } from "@/server/errors"

/**
 * Deletes every TEST-environment payment and its dependent records. LIVE
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

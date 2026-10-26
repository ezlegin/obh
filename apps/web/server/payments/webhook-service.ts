import "server-only"

import { createHmac, randomUUID } from "node:crypto"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { decryptWebhookSecret } from "@/server/payments/webhook-secret"

const MAX_ATTEMPTS = 6
const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200, 21600]
const DELIVERY_TIMEOUT_MS = 5000

type DeliveryPayload = {
  id: string
  type: "payment.completed" | "payment.failed"
  createdAt: string
  data: {
    id: string
    reference: string
    service: string
    externalOrderId: string | null
    amount: string
    currency: string
    environment: "test" | "live"
    status: "completed" | "failed"
    description: string
    receipt: {
      orderNumber: string
      traceNumber: string | null
      referenceNumber: string | null
      maskedCardNumber: string | null
      resultCode: number | null
      resultMessage: string | null
    }
    createdAt: string
    completedAt: string | null
    verifiedAt: string | null
  }
}

export async function queuePaymentWebhook(paymentId: string) {
  const db = getDb()

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      service: {
        select: {
          id: true,
          slug: true,
          webhookUrl: true,
          webhookSecretEncrypted: true,
        },
      },
    },
  })

  if (
    !payment ||
    !payment.service ||
    (payment.status !== "COMPLETED" && payment.status !== "FAILED") ||
    !payment.service.webhookUrl ||
    !payment.service.webhookSecretEncrypted
  ) {
    return null
  }

  const type =
    payment.status === "COMPLETED"
      ? ("payment.completed" as const)
      : ("payment.failed" as const)

  const existing = await db.webhookDelivery.findFirst({
    where: { paymentId: payment.id, eventType: type },
    select: { id: true },
  })

  if (existing) {
    return existing
  }

  const payload: DeliveryPayload = {
    id: `evt_${randomUUID().replaceAll("-", "")}`,
    type,
    createdAt: new Date().toISOString(),
    data: {
      id: payment.id,
      reference: payment.reference,
      service: payment.service.slug,
      externalOrderId: payment.externalOrderId,
      amount: payment.amount.toFixed(0),
      currency: payment.currency,
      environment: payment.environment === "LIVE" ? "live" : "test",
      status: payment.status === "COMPLETED" ? "completed" : "failed",
      description: payment.description,
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
    },
  }

  const delivery = await db.webhookDelivery.create({
    data: {
      serviceId: payment.service.id,
      paymentId: payment.id,
      eventType: type,
      endpoint: payment.service.webhookUrl,
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date(),
      payload: payload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  })

  await attemptWebhookDelivery(delivery.id).catch((error) => {
    console.error(
      "Immediate webhook delivery failed.",
      error instanceof Error ? error.name : "Unknown error"
    )
  })

  return delivery
}

export async function attemptWebhookDelivery(deliveryId: string) {
  const db = getDb()

  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      service: {
        select: {
          webhookUrl: true,
          webhookSecretEncrypted: true,
        },
      },
    },
  })

  if (
    !delivery ||
    delivery.status === "DELIVERED" ||
    delivery.status === "EXHAUSTED"
  ) {
    return delivery
  }

  if (!delivery.service.webhookSecretEncrypted) {
    return db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "EXHAUSTED",
        lastAttemptAt: new Date(),
        lastError: "Webhook signing secret is not configured.",
      },
    })
  }

  const now = new Date()
  const attempts = delivery.attempts + 1
  const body = JSON.stringify(delivery.payload)
  const timestamp = Math.floor(now.getTime() / 1000)
  const signature = createHmac(
    "sha256",
    decryptWebhookSecret(delivery.service.webhookSecretEncrypted)
  )
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

  try {
    const response = await fetch(delivery.endpoint, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OBH-Webhooks/1.0",
        "OBH-Event-Id": String(
          (delivery.payload as { id?: string } | null)?.id ?? delivery.id
        ),
        "OBH-Timestamp": String(timestamp),
        "OBH-Signature": `t=${timestamp},v1=${signature}`,
      },
      body,
    })

    if (response.status >= 200 && response.status < 300) {
      return db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          attempts,
          lastAttemptAt: now,
          nextAttemptAt: null,
          deliveredAt: now,
          lastError: null,
        },
      })
    }

    return failDelivery(delivery.id, attempts, now, `HTTP ${response.status}`)
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Delivery timed out."
        : "Delivery request failed."

    return failDelivery(delivery.id, attempts, now, message)
  } finally {
    clearTimeout(timeout)
  }
}

async function failDelivery(
  deliveryId: string,
  attempts: number,
  now: Date,
  error: string
) {
  const exhausted = attempts >= MAX_ATTEMPTS
  const delay =
    RETRY_DELAYS_SECONDS[
      Math.min(attempts - 1, RETRY_DELAYS_SECONDS.length - 1)
    ] ?? 21600

  return getDb().webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: exhausted ? "EXHAUSTED" : "PENDING",
      attempts,
      lastAttemptAt: now,
      nextAttemptAt: exhausted ? null : new Date(now.getTime() + delay * 1000),
      lastError: error.slice(0, 500),
    },
  })
}

export async function processDueWebhooks(limit = 20) {
  const now = new Date()
  const deliveries = await getDb().webhookDelivery.findMany({
    where: {
      status: "PENDING",
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  })

  let delivered = 0
  let failed = 0

  for (const delivery of deliveries) {
    const result = await attemptWebhookDelivery(delivery.id)

    if (result?.status === "DELIVERED") {
      delivered += 1
    } else {
      failed += 1
    }
  }

  return { processed: deliveries.length, delivered, failed }
}

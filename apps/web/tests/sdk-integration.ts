import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { createServer } from "node:http"

import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { OBHPayments, isOBHPaymentsError } from "@obh/payments"

import { PrismaClient } from "../lib/generated/prisma/client"
import { generateServiceCredential } from "../server/payments/service-credentials"
import {
  encryptWebhookSecret,
  generateWebhookSecret,
} from "../server/payments/webhook-secret"
import { processDueWebhooks } from "../server/payments/webhook-service"

config({ path: ".env.local" })
config()

const baseUrl = process.env.OBH_API_BASE_URL ?? "http://localhost:3100"
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required for the integration test.")
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

const suffix = Date.now().toString(36)
const alphaName = `SDK Alpha ${suffix}`
const betaName = `SDK Beta ${suffix}`
const alphaSlug = `sdk-alpha-${suffix}`
const betaSlug = `sdk-beta-${suffix}`
const alphaReturnUrl = `https://alpha-${suffix}.example/return`
const betaReturnUrl = `https://beta-${suffix}.example/return`
const alphaOrder = `SDK-A-${suffix}`
const betaOrder = `SDK-B-${suffix}`

type ReceivedWebhook = {
  path: string
  headers: Record<string, string | string[] | undefined>
  body: string
}

const received: ReceivedWebhook[] = []
let flakyFailures = 0

const receiver = createServer((request, response) => {
  const chunks: Buffer[] = []

  request.on("data", (chunk: Buffer) => chunks.push(chunk))
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8")
    const path = request.url ?? "/"

    if (path === "/flaky" && flakyFailures === 0) {
      flakyFailures += 1
      response.statusCode = 500
      response.end("retry")
      return
    }

    received.push({ path, headers: request.headers, body })
    response.statusCode = 200
    response.end("ok")
  })
})

await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve))
const address = receiver.address()

if (!address || typeof address === "string") {
  throw new Error("Could not start webhook receiver.")
}

const webhookBase = `http://127.0.0.1:${address.port}`
const webhookSecret = generateWebhookSecret()

async function waitFor<T>(
  read: () => T | null | undefined | Promise<T | null | undefined>,
  timeoutMs = 5000
): Promise<T> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = await read()
    if (value) {
      return value
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error("Timed out waiting for integration condition.")
}

function verifySignature(webhook: ReceivedWebhook) {
  const signature = String(webhook.headers["obh-signature"] ?? "")
  const timestamp = String(webhook.headers["obh-timestamp"] ?? "")
  const [timestampPart, signaturePart] = signature.split(",")
  const provided = signaturePart?.replace(/^v1=/, "") ?? ""
  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${webhook.body}`, "utf8")
    .digest("hex")

  assert.equal(timestampPart, `t=${timestamp}`)
  assert.equal(provided, expected)
}

async function completeCheckout(
  checkoutUrl: string,
  outcome: "success" | "failure"
) {
  const response = await fetch(`${checkoutUrl}/complete`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ outcome }),
  })

  assert.equal(response.status, 303)
}

async function expectSdkError(
  action: () => Promise<unknown>,
  code: string,
  status: number
) {
  await assert.rejects(
    action,
    (error) =>
      isOBHPaymentsError(error) &&
      error.code === code &&
      error.status === status
  )
}

try {
  const provider = await db.paymentProvider.upsert({
    where: { code: "development" },
    update: { isActive: true },
    create: {
      code: "development",
      name: "Development Gateway",
      description: "Local integration test adapter.",
      isActive: true,
    },
  })

  let providerAccount = await db.financialAccount.findFirst({
    where: { providerId: provider.id, kind: "PROVIDER", environment: "TEST" },
  })

  if (!providerAccount) {
    providerAccount = await db.financialAccount.create({
      data: {
        name: `SDK integration account ${suffix}`,
        kind: "PROVIDER",
        providerId: provider.id,
        environment: "TEST",
        currency: "IRR",
        openingBalance: 0,
      },
    })
  }

  const alpha = await db.connectedService.create({
    data: {
      name: alphaName,
      slug: alphaSlug,
      domain: `alpha-${suffix}.example`,
      allowedReturnUrls: [alphaReturnUrl],
      defaultReturnUrl: alphaReturnUrl,
      webhookUrl: `${webhookBase}/hook`,
      webhookSecretEncrypted: encryptWebhookSecret(webhookSecret),
      webhookSecretCreatedAt: new Date(),
    },
  })

  const beta = await db.connectedService.create({
    data: {
      name: betaName,
      slug: betaSlug,
      domain: `beta-${suffix}.example`,
      allowedReturnUrls: [betaReturnUrl],
      defaultReturnUrl: betaReturnUrl,
    },
  })

  const alphaKey = generateServiceCredential("TEST")
  const betaKey = generateServiceCredential("TEST")

  const alphaCredential = await db.serviceCredential.create({
    data: {
      serviceId: alpha.id,
      keyId: alphaKey.keyId,
      secretHash: alphaKey.secretHash,
      label: "SDK integration",
      environment: "TEST",
    },
  })

  await db.serviceCredential.create({
    data: {
      serviceId: beta.id,
      keyId: betaKey.keyId,
      secretHash: betaKey.secretHash,
      label: "SDK integration",
      environment: "TEST",
    },
  })

  const alphaSdk = new OBHPayments({
    secretKey: alphaKey.presentedKey,
    baseUrl,
  })
  const betaSdk = new OBHPayments({
    secretKey: betaKey.presentedKey,
    baseUrl,
  })

  const paymentInput = {
    externalOrderId: alphaOrder,
    amount: "1250000",
    description: "SDK integration payment",
    returnUrl: alphaReturnUrl,
    metadata: { suite: "sdk-integration", attempt: 1 },
    idempotencyKey: `itest-${suffix}-primary`,
  } as const

  await expectSdkError(
    () =>
      alphaSdk.startPayment({
        externalOrderId: `SDK-BAD-URL-${suffix}`,
        amount: "1000",
        description: "Invalid return URL",
        returnUrl: "https://not-allowed.example/return",
        idempotencyKey: `itest-${suffix}-bad-url`,
      }),
    "RETURN_URL_NOT_ALLOWED",
    422
  )

  const payment = await alphaSdk.startPayment(paymentInput)

  assert.equal(payment.status, "pending")
  assert.equal(payment.environment, "test")
  assert.equal(payment.service, alphaSlug)
  assert.match(
    payment.checkoutUrl ?? "",
    /^http:\/\/localhost:3100\/pay\/dev\/dev_sess_/
  )

  const retrieved = await alphaSdk.getPayment(payment.reference)
  assert.equal(retrieved.reference, payment.reference)
  assert.equal(retrieved.externalOrderId, alphaOrder)

  await expectSdkError(
    () => betaSdk.getPayment(payment.reference),
    "PAYMENT_NOT_FOUND",
    404
  )

  const replay = await alphaSdk.startPayment(paymentInput)
  assert.equal(replay.reference, payment.reference)
  assert.equal(replay.status, "pending")

  await expectSdkError(
    () =>
      alphaSdk.startPayment({
        ...paymentInput,
        amount: "1250001",
      }),
    "IDEMPOTENCY_CONFLICT",
    409
  )

  const orderReplay = await alphaSdk.startPayment({
    ...paymentInput,
    idempotencyKey: `itest-${suffix}-order-replay`,
  })
  assert.equal(orderReplay.reference, payment.reference)

  await expectSdkError(
    () =>
      alphaSdk.startPayment({
        ...paymentInput,
        externalOrderId: `SDK-KEY-REUSE-${suffix}`,
        idempotencyKey: `itest-${suffix}-order-replay`,
      }),
    "IDEMPOTENCY_CONFLICT",
    409
  )

  await expectSdkError(
    () =>
      alphaSdk.startPayment({
        ...paymentInput,
        amount: "999",
        idempotencyKey: `itest-${suffix}-order-conflict`,
      }),
    "ORDER_CONFLICT",
    409
  )

  const betaPayment = await betaSdk.startPayment({
    externalOrderId: betaOrder,
    amount: "500000",
    description: "Beta SDK payment",
    returnUrl: betaReturnUrl,
    idempotencyKey: `itest-${suffix}-beta`,
  })

  await expectSdkError(
    () => alphaSdk.getPayment(betaPayment.reference),
    "PAYMENT_NOT_FOUND",
    404
  )

  await expectSdkError(
    () =>
      new OBHPayments({
        secretKey: "svc_test_invalid.invalid",
        baseUrl,
      }).getPayment(payment.reference),
    "AUTH_INVALID",
    401
  )

  assert.ok(payment.checkoutUrl)
  await completeCheckout(payment.checkoutUrl, "success")

  const completed = await alphaSdk.getPayment(payment.reference)
  assert.equal(completed.status, "completed")
  assert.ok(completed.verifiedAt)

  const webhook = await waitFor(() =>
    received.find((item) => item.body.includes(payment.reference))
  )

  verifySignature(webhook)
  const event = JSON.parse(webhook.body) as {
    id: string
    type: string
    data: { reference: string; status: string; environment: string }
  }
  assert.equal(event.type, "payment.completed")
  assert.equal(event.data.reference, payment.reference)
  assert.equal(event.data.status, "completed")
  assert.equal(event.data.environment, "test")
  assert.equal(webhook.headers["obh-event-id"], event.id)

  await db.connectedService.update({
    where: { id: alpha.id },
    data: { webhookUrl: `${webhookBase}/flaky` },
  })

  const failedPayment = await alphaSdk.startPayment({
    externalOrderId: `SDK-F-${suffix}`,
    amount: "250000",
    description: "SDK failed payment",
    returnUrl: alphaReturnUrl,
    idempotencyKey: `itest-${suffix}-failed`,
  })

  assert.ok(failedPayment.checkoutUrl)
  await completeCheckout(failedPayment.checkoutUrl, "failure")

  const failed = await alphaSdk.getPayment(failedPayment.reference)
  assert.equal(failed.status, "failed")

  const retryDelivery = await waitFor(async () => {
    const delivery = await db.webhookDelivery.findFirst({
      where: {
        paymentId: failed.id,
        eventType: "payment.failed",
      },
    })

    return delivery ?? null
  })

  assert.equal(retryDelivery.status, "PENDING")
  assert.equal(retryDelivery.attempts, 1)

  await db.webhookDelivery.update({
    where: { id: retryDelivery.id },
    data: { nextAttemptAt: new Date(0) },
  })

  const worker = await processDueWebhooks()
  assert.equal(worker.processed >= 1, true)

  const delivered = await db.webhookDelivery.findUniqueOrThrow({
    where: { id: retryDelivery.id },
  })
  assert.equal(delivered.status, "DELIVERED")
  assert.equal(delivered.attempts, 2)

  const retryWebhook = await waitFor(() =>
    received.find((item) => item.body.includes(failedPayment.reference))
  )
  verifySignature(retryWebhook)

  await db.serviceCredential.update({
    where: { id: alphaCredential.id },
    data: { revokedAt: new Date() },
  })

  await expectSdkError(
    () => alphaSdk.getPayment(payment.reference),
    "AUTH_INVALID",
    401
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        api: baseUrl,
        alphaSlug,
        betaSlug,
        paymentReference: payment.reference,
        completedStatus: completed.status,
        failedStatus: failed.status,
        crossServiceIsolation: "verified both directions",
        idempotency: "replay and conflict verified",
        webhook: "signature verified",
        retry: {
          attempts: delivered.attempts,
          status: delivered.status,
        },
        revokedCredential: "rejected",
        providerAccount: providerAccount.name,
      },
      null,
      2
    )
  )
} finally {
  await new Promise<void>((resolve) => {
    receiver.close(() => resolve())
  })
  await db.$disconnect()
}

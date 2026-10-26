import { createPaymentRequestSchema } from "@/lib/validation/payment-api"
import {
  classifyApiErrorForLog,
  recordAuthenticatedApiCall,
} from "@/server/api/api-logs"
import { apiErrorResponse, apiJson, createRequestId } from "@/server/api/errors"
import {
  readIdempotencyKey,
  parseBody,
  readJsonObject,
} from "@/server/api/request"
import {
  authenticateServiceRequest,
  type ServiceAuthContext,
} from "@/server/api/service-auth"
import { createApiPayment } from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const requestId = createRequestId()
  const startedAt = Date.now()
  let auth: ServiceAuthContext | null = null
  let idempotencyKey: string | null = null
  let rawBody: Record<string, unknown> | null = null

  try {
    auth = await authenticateServiceRequest(request)
    idempotencyKey = readIdempotencyKey(request)
    const body = await readJsonObject(request)
    rawBody =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null
    const input = parseBody(createPaymentRequestSchema, body)

    const result = await createApiPayment(
      auth,
      input,
      idempotencyKey,
      new URL(request.url).origin
    )

    const statusCode = result.replayed ? 200 : 201
    await recordAuthenticatedApiCall({
      requestId,
      request,
      auth,
      method: "POST",
      path: "/api/v1/payments",
      statusCode,
      durationMs: Date.now() - startedAt,
      paymentReference: result.payment.reference,
      externalOrderId: input.externalOrderId,
      amount: input.amount,
      simulator: Boolean(input.simulator),
      idempotencyKey,
      replayed: result.replayed,
      requestBody: rawBody,
    })

    return apiJson(
      { data: result.payment },
      {
        status: statusCode,
        requestId,
        headers: {
          Location: `/api/v1/payments/${result.payment.reference}`,
          ...(result.replayed ? { "Idempotent-Replayed": "true" } : {}),
        },
      }
    )
  } catch (error) {
    if (auth) {
      const classified = classifyApiErrorForLog(error)
      await recordAuthenticatedApiCall({
        requestId,
        request,
        auth,
        method: "POST",
        path: "/api/v1/payments",
        statusCode: classified.statusCode,
        durationMs: Date.now() - startedAt,
        idempotencyKey,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
        requestBody: rawBody,
      })
    }
    return apiErrorResponse(error, requestId)
  }
}

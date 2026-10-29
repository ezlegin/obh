import { financeEventSchema } from "@/lib/validation/finance-events"
import {
  classifyApiErrorForLog,
  recordAuthenticatedApiCall,
} from "@/server/api/api-logs"
import { apiErrorResponse, apiJson, createRequestId } from "@/server/api/errors"
import { parseBody, readJsonObject } from "@/server/api/request"
import {
  authenticateServiceRequest,
  type ServiceAuthContext,
} from "@/server/api/service-auth"
import { ingestPaymentSnapshot } from "@/server/finance/ingest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Finance events from a connected service (`@obhco/pay`). Authenticated with
 * the service credential; the service has already verified the payment with
 * its own bank terminal.
 */
export async function POST(request: Request) {
  const requestId = createRequestId()
  const startedAt = Date.now()
  let auth: ServiceAuthContext | null = null
  let rawBody: Record<string, unknown> | null = null

  try {
    auth = await authenticateServiceRequest(request)
    const body = await readJsonObject(request)
    rawBody = body as Record<string, unknown>
    const event = parseBody(financeEventSchema, body)

    const result = await ingestPaymentSnapshot(auth, event.data)
    const statusCode = result.created ? 201 : 200

    await recordAuthenticatedApiCall({
      requestId,
      request,
      auth,
      method: "POST",
      path: "/api/v1/finance/events",
      statusCode,
      durationMs: Date.now() - startedAt,
      paymentReference: result.reference,
      externalOrderId: event.data.orderId,
      amount: event.data.amount,
      idempotencyKey: event.eventId,
      replayed: !result.created && !result.changed,
      requestBody: rawBody,
    })

    return apiJson(
      { data: result },
      { status: statusCode, requestId }
    )
  } catch (error) {
    if (auth) {
      const classified = classifyApiErrorForLog(error)
      await recordAuthenticatedApiCall({
        requestId,
        request,
        auth,
        method: "POST",
        path: "/api/v1/finance/events",
        statusCode: classified.statusCode,
        durationMs: Date.now() - startedAt,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
        requestBody: rawBody,
      })
    }
    return apiErrorResponse(error, requestId)
  }
}

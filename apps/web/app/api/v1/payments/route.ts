import { createPaymentRequestSchema } from "@/lib/validation/payment-api"
import { apiErrorResponse, apiJson, createRequestId } from "@/server/api/errors"
import {
  readIdempotencyKey,
  parseBody,
  readJsonObject,
} from "@/server/api/request"
import { authenticateServiceRequest } from "@/server/api/service-auth"
import { createApiPayment } from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const requestId = createRequestId()

  try {
    const auth = await authenticateServiceRequest(request)
    const idempotencyKey = readIdempotencyKey(request)
    const body = await readJsonObject(request)
    const input = parseBody(createPaymentRequestSchema, body)

    const result = await createApiPayment(
      auth,
      input,
      idempotencyKey,
      new URL(request.url).origin
    )

    return apiJson(
      { data: result.payment },
      {
        status: result.replayed ? 200 : 201,
        requestId,
        headers: {
          Location: `/api/v1/payments/${result.payment.reference}`,
          ...(result.replayed ? { "Idempotent-Replayed": "true" } : {}),
        },
      }
    )
  } catch (error) {
    return apiErrorResponse(error, requestId)
  }
}

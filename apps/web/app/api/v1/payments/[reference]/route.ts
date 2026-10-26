import {
  classifyApiErrorForLog,
  recordAuthenticatedApiCall,
} from "@/server/api/api-logs"
import { apiErrorResponse, apiJson, createRequestId } from "@/server/api/errors"
import {
  authenticateServiceRequest,
  type ServiceAuthContext,
} from "@/server/api/service-auth"
import { getApiPayment } from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ reference: string }> }
) {
  const requestId = createRequestId()
  const startedAt = Date.now()
  let auth: ServiceAuthContext | null = null
  let referenceParam = ""

  try {
    auth = await authenticateServiceRequest(request)
    const { reference } = await context.params
    referenceParam = reference ?? ""

    if (!reference || reference.length > 64) {
      await recordAuthenticatedApiCall({
        requestId,
        request,
        auth,
        method: "GET",
        path: `/api/v1/payments/${referenceParam}`,
        statusCode: 404,
        durationMs: Date.now() - startedAt,
        errorCode: "PAYMENT_NOT_FOUND",
        errorMessage: "Payment was not found.",
      })

      return apiJson(
        {
          error: {
            code: "PAYMENT_NOT_FOUND",
            message: "Payment was not found.",
            requestId,
          },
        },
        { status: 404, requestId }
      )
    }

    const payment = await getApiPayment(
      auth.service.id,
      auth.service.slug,
      reference
    )

    await recordAuthenticatedApiCall({
      requestId,
      request,
      auth,
      method: "GET",
      path: `/api/v1/payments/${reference}`,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      paymentReference: payment.reference,
      externalOrderId: payment.externalOrderId,
      amount: payment.amount,
      simulator: payment.environment === "test",
    })

    return apiJson({ data: payment }, { status: 200, requestId })
  } catch (error) {
    if (auth) {
      const classified = classifyApiErrorForLog(error)
      await recordAuthenticatedApiCall({
        requestId,
        request,
        auth,
        method: "GET",
        path: `/api/v1/payments/${referenceParam}`,
        statusCode: classified.statusCode,
        durationMs: Date.now() - startedAt,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
      })
    }
    return apiErrorResponse(error, requestId)
  }
}

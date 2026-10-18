import { apiErrorResponse, apiJson, createRequestId } from "@/server/api/errors"
import { authenticateServiceRequest } from "@/server/api/service-auth"
import { getApiPayment } from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ reference: string }> }
) {
  const requestId = createRequestId()

  try {
    const auth = await authenticateServiceRequest(request)
    const { reference } = await context.params

    if (!reference || reference.length > 64) {
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

    return apiJson({ data: payment }, { status: 200, requestId })
  } catch (error) {
    return apiErrorResponse(error, requestId)
  }
}

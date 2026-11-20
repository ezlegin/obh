import { invoiceBuyerSchema, orderIdSchema } from "@/lib/validation/tax-invoices"
import {
  classifyApiErrorForLog,
  recordAuthenticatedApiCall,
} from "@/server/api/api-logs"
import {
  ApiError,
  apiErrorResponse,
  apiJson,
  createRequestId,
} from "@/server/api/errors"
import { parseBody, readJsonObject } from "@/server/api/request"
import {
  authenticateServiceRequest,
  type ServiceAuthContext,
} from "@/server/api/service-auth"
import { DomainError } from "@/server/errors"
import {
  getOrderInvoice,
  removeOrderInvoiceBuyer,
  setOrderInvoiceBuyer,
} from "@/server/tax-invoices/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ orderId: string }> }

/**
 * The electronic invoice (سامانه مودیان) of one of the service's orders.
 *
 *   GET     its state
 *   PUT     buyer details, so the sale is invoiced as type 1 (official invoice)
 *   DELETE  withdraw them while the invoice has not reached Kisan
 *
 * Buyer details are personal data: they are never written to the API log.
 */
async function handle(
  request: Request,
  context: Context,
  method: "GET" | "PUT" | "DELETE"
) {
  const requestId = createRequestId()
  const startedAt = Date.now()
  let auth: ServiceAuthContext | null = null
  let orderId: string | undefined
  const path = "/api/v1/finance/orders/{orderId}/invoice"

  try {
    auth = await authenticateServiceRequest(request)
    const parsedOrderId = orderIdSchema.safeParse((await context.params).orderId)
    if (!parsedOrderId.success) {
      throw new ApiError(400, "INVALID_ORDER_ID", "The order id is not valid.")
    }
    orderId = parsedOrderId.data
    const serviceId = auth.service.id

    let data
    try {
      if (method === "GET") {
        data = await getOrderInvoice(serviceId, orderId)
        if (!data) {
          throw new ApiError(404, "PAYMENT_NOT_FOUND", "No completed payment for this order.")
        }
      } else if (method === "PUT") {
        const body = parseBody(invoiceBuyerSchema, await readJsonObject(request))
        data = await setOrderInvoiceBuyer(serviceId, orderId, {
          buyerType: body.buyerType === "company" ? 2 : 1,
          name: body.name,
          nationalId: body.nationalId,
          economicCode: body.economicCode ?? null,
          postalCode: body.postalCode,
          phone: body.phone,
        })
      } else {
        data = await removeOrderInvoiceBuyer(serviceId, orderId)
      }
    } catch (error) {
      if (error instanceof DomainError) {
        const status = error.code === "NOT_FOUND" ? 404 : 409
        throw new ApiError(
          status,
          error.code === "NOT_FOUND" ? "PAYMENT_NOT_FOUND" : error.code,
          error.message
        )
      }
      throw error
    }

    await recordAuthenticatedApiCall({
      requestId,
      request,
      auth,
      method,
      path,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      externalOrderId: orderId,
    })
    return apiJson({ data }, { status: 200, requestId })
  } catch (error) {
    if (auth) {
      const classified = classifyApiErrorForLog(error)
      await recordAuthenticatedApiCall({
        requestId,
        request,
        auth,
        method,
        path,
        statusCode: classified.statusCode,
        durationMs: Date.now() - startedAt,
        externalOrderId: orderId,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
      })
    }
    return apiErrorResponse(error, requestId)
  }
}

export function GET(request: Request, context: Context) {
  return handle(request, context, "GET")
}

export function PUT(request: Request, context: Context) {
  return handle(request, context, "PUT")
}

export function DELETE(request: Request, context: Context) {
  return handle(request, context, "DELETE")
}

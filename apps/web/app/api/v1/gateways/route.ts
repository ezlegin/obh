import {
  classifyApiErrorForLog,
  recordAuthenticatedApiCall,
} from "@/server/api/api-logs"
import { apiErrorResponse, apiJson, createRequestId } from "@/server/api/errors"
import {
  authenticateServiceRequest,
  type ServiceAuthContext,
} from "@/server/api/service-auth"
import { listAvailablePaymentGateways } from "@/server/payments/providers/registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Lists the payment gateways a connected service can offer at checkout.
 * `?simulator=true` lists TEST (simulated) gateways; otherwise only LIVE
 * gateways whose credentials are configured on the server are returned.
 */
export async function GET(request: Request) {
  const requestId = createRequestId()
  const startedAt = Date.now()
  let auth: ServiceAuthContext | null = null

  try {
    auth = await authenticateServiceRequest(request)
    const simulator =
      new URL(request.url).searchParams.get("simulator")?.toLowerCase() ===
      "true"

    const gateways = listAvailablePaymentGateways(
      simulator ? "TEST" : "LIVE"
    ).map((gateway) => ({
      code: gateway.code,
      name: gateway.name,
      displayName: gateway.displayName,
      description: gateway.description,
      kind: gateway.kind,
      requiresCustomerMobile: gateway.requiresCustomerMobile,
      minAmount: gateway.minAmount,
      isDefault: gateway.isDefault,
      environment: simulator ? "test" : "live",
    }))

    await recordAuthenticatedApiCall({
      requestId,
      request,
      auth,
      method: "GET",
      path: "/api/v1/gateways",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      simulator,
    })

    return apiJson({ data: gateways }, { status: 200, requestId })
  } catch (error) {
    if (auth) {
      const classified = classifyApiErrorForLog(error)
      await recordAuthenticatedApiCall({
        requestId,
        request,
        auth,
        method: "GET",
        path: "/api/v1/gateways",
        statusCode: classified.statusCode,
        durationMs: Date.now() - startedAt,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
      })
    }
    return apiErrorResponse(error, requestId)
  }
}

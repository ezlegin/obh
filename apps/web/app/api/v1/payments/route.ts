import { apiErrorResponse, createRequestId } from "@/server/api/errors"
import { ApiError } from "@/server/api/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * OBH no longer hosts payment gateways. Each service runs its own gateway
 * terminal with `@obhco/pay` and reports payments to
 * `POST /api/v1/finance/events`. This route stays so old clients get a clear
 * answer instead of a 404.
 */
function gone() {
  return apiErrorResponse(
    new ApiError(
      410,
      "ENDPOINT_RETIRED",
      "OBH no longer processes payments. Use @obhco/pay inside your service to take payments with your own gateway terminal; OBH receives the finance reports."
    ),
    createRequestId()
  )
}

export const GET = gone
export const POST = gone

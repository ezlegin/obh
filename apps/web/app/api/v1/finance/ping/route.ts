import { apiErrorResponse, apiJson, createRequestId } from "@/server/api/errors"
import { authenticateServiceRequest } from "@/server/api/service-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Confirms a service credential works. Sends and stores no data. */
export async function GET(request: Request) {
  const requestId = createRequestId()

  try {
    const auth = await authenticateServiceRequest(request)

    return apiJson(
      {
        ok: true,
        service: { slug: auth.service.slug, name: auth.service.name },
      },
      { status: 200, requestId }
    )
  } catch (error) {
    return apiErrorResponse(error, requestId)
  }
}

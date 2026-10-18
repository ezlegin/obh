import { randomUUID } from "node:crypto"

export type ApiErrorDetail = {
  field?: string
  message: string
}

export class ApiError extends Error {
  status: number
  code: string
  details?: ApiErrorDetail[]
  headers?: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    options?: {
      details?: ApiErrorDetail[]
      headers?: Record<string, string>
    }
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = options?.details
    this.headers = options?.headers
  }
}

export function createRequestId() {
  return `req_${randomUUID().replaceAll("-", "")}`
}

function baseHeaders(requestId: string) {
  return {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
    "X-Content-Type-Options": "nosniff",
  }
}

export function apiJson(
  data: unknown,
  options: {
    status: number
    requestId: string
    headers?: Record<string, string>
  }
) {
  return Response.json(data, {
    status: options.status,
    headers: {
      ...baseHeaders(options.requestId),
      ...options.headers,
    },
  })
}

export function apiErrorResponse(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      {
        status: error.status,
        headers: {
          ...baseHeaders(requestId),
          ...error.headers,
        },
      }
    )
  }

  console.error(`Unhandled API error [${requestId}].`, error)

  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        requestId,
      },
    },
    {
      status: 500,
      headers: baseHeaders(requestId),
    }
  )
}

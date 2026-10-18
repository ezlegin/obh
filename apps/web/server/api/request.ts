import { z } from "zod"

import { ApiError } from "@/server/api/errors"
import { idempotencyKeySchema } from "@/lib/validation/payment-api"

const MAX_BODY_BYTES = 32 * 1024

export async function readJsonObject(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? ""

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Use Content-Type: application/json."
    )
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      "The request body is too large."
    )
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "The JSON body is invalid.")
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "The JSON body must be an object."
    )
  }

  return body
}

export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): z.infer<T> {
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || undefined,
        message: issue.message,
      })),
    })
  }

  return parsed.data
}

export function readIdempotencyKey(request: Request) {
  const raw = request.headers.get("idempotency-key")

  if (!raw) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Idempotency-Key is required.",
      {
        details: [{ field: "Idempotency-Key", message: "Header is required." }],
      }
    )
  }

  const parsed = idempotencyKeySchema.safeParse(raw)

  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Idempotency-Key is invalid.", {
      details: [
        {
          field: "Idempotency-Key",
          message: parsed.error.issues[0]?.message ?? "Header is invalid.",
        },
      ],
    })
  }

  return parsed.data
}

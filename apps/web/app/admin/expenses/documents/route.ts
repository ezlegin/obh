import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import { DomainError } from "@/server/errors"
import {
  attachExpenseDocument,
  MAX_EXPENSE_DOCUMENT_BYTES,
} from "@/server/accounting/documents"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const expenseIdSchema = z.string().uuid()

function jsonError(message: string, status: number) {
  return Response.json(
    { ok: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  )
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  const origin = request.headers.get("origin")

  if (origin && origin !== new URL(request.url).origin) {
    return jsonError("Cross-origin uploads are not allowed.", 403)
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_EXPENSE_DOCUMENT_BYTES + 1024 * 1024
  ) {
    return jsonError("Documents cannot exceed 10 MB.", 413)
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return jsonError("The upload could not be read.", 400)
  }

  const expenseId = formData.get("expenseId")
  const file = formData.get("file")
  const parsedExpenseId = expenseIdSchema.safeParse(expenseId)

  if (!parsedExpenseId.success) {
    return jsonError("Invalid expense.", 400)
  }

  if (!(file instanceof File)) {
    return jsonError("Select a document to upload.", 400)
  }

  try {
    const document = await attachExpenseDocument(
      admin.id,
      parsedExpenseId.data,
      file
    )

    return Response.json(
      {
        ok: true,
        document: {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          byteSize: document.byteSize,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    if (error instanceof DomainError) {
      return jsonError(error.message, 400)
    }

    console.error(
      "Expense document upload failed.",
      error instanceof Error ? error.name : "Unknown error"
    )

    return jsonError("The document could not be uploaded.", 500)
  }
}

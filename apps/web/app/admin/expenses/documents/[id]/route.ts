import { requireAdmin } from "@/lib/auth/guards"
import { getExpenseDocumentForDownload } from "@/server/accounting/documents"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireAdmin()
  const { id } = await context.params

  let document

  try {
    document = await getExpenseDocumentForDownload(id)
  } catch {
    return new Response("Document not found.", { status: 404 })
  }

  if (!document) {
    return new Response("Document not found.", { status: 404 })
  }

  const asciiName = document.fileName.replace(/[^\x20-\x7e]/g, "_")

  return new Response(new Uint8Array(document.file), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.byteSize),
      "Content-Disposition": `attachment; filename="${asciiName.replaceAll('"', "")}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  })
}

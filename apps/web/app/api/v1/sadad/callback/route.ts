import { NextResponse } from "next/server"

import {
  processSadadCallback,
  type SadadCallbackPayload,
} from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function redirectToReturnUrl(
  request: Request,
  reference: string,
  status: string,
  returnUrl: string | null
) {
  if (returnUrl) {
    try {
      const target = new URL(returnUrl)
      target.searchParams.set("obh_reference", reference)
      target.searchParams.set("status", status.toLowerCase())
      return NextResponse.redirect(target, 303)
    } catch {
      // Fall through if stored URL is malformed
    }
  }

  return NextResponse.json(
    {
      data: {
        reference,
        status: status.toLowerCase(),
      },
    },
    { status: 200 }
  )
}

async function readCallbackPayload(
  request: Request
): Promise<SadadCallbackPayload> {
  const contentType = request.headers.get("content-type") ?? ""

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData()
    const read = (key: string) => {
      const val = formData.get(key) ?? formData.get(key.toLowerCase())
      return typeof val === "string" ? val : null
    }

    return {
      OrderId: read("OrderId"),
      Token: read("Token"),
      ResCode: read("ResCode"),
      SwitchResCode: read("SwitchResCode"),
      PrimaryAccNo: read("PrimaryAccNo"),
      HashedCardNo: read("HashedCardNo"),
      CardHolderFullName: read("CardHolderFullName"),
    }
  }

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const read = (key: string) => {
      const val = body[key] ?? body[key.toLowerCase()]
      return val !== undefined && val !== null ? String(val) : null
    }

    return {
      OrderId: read("OrderId"),
      Token: read("Token"),
      ResCode: read("ResCode"),
      SwitchResCode: read("SwitchResCode"),
      PrimaryAccNo: read("PrimaryAccNo"),
      HashedCardNo: read("HashedCardNo"),
      CardHolderFullName: read("CardHolderFullName"),
    }
  }

  const rawText = await request.text().catch(() => "")
  const params = new URLSearchParams(rawText)
  const read = (key: string) =>
    params.get(key) ?? params.get(key.toLowerCase())

  return {
    OrderId: read("OrderId"),
    Token: read("Token"),
    ResCode: read("ResCode"),
    SwitchResCode: read("SwitchResCode"),
    PrimaryAccNo: read("PrimaryAccNo"),
    HashedCardNo: read("HashedCardNo"),
    CardHolderFullName: read("CardHolderFullName"),
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readCallbackPayload(request)
    const result = await processSadadCallback(payload)

    return redirectToReturnUrl(
      request,
      result.reference,
      result.status,
      result.returnUrl
    )
  } catch (error) {
    console.error(
      "Sadad callback processing failed.",
      error instanceof Error ? error.name : "Unknown error"
    )

    return NextResponse.json(
      {
        error: {
          code: "CALLBACK_ERROR",
          message: "Payment callback could not be processed.",
        },
      },
      { status: 400 }
    )
  }
}

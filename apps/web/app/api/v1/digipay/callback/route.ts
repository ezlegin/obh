import { NextResponse } from "next/server"

import {
  processDigipayCallback,
  type DigipayCallbackPayload,
} from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FIELDS = [
  "amount",
  "providerId",
  "trackingCode",
  "rrn",
  "psp",
  "isCredit",
  "result",
  "type",
] as const

function redirectToReturnUrl(
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

function stringify(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

async function readCallbackPayload(
  request: Request
): Promise<DigipayCallbackPayload> {
  const contentType = request.headers.get("content-type") ?? ""
  let read: (key: string) => string | null

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    read = (key) => stringify(body[key])
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData()
    read = (key) => {
      const value = formData.get(key)
      return typeof value === "string" ? value : null
    }
  } else {
    const params = new URLSearchParams(await request.text().catch(() => ""))
    read = (key) => params.get(key)
  }

  return Object.fromEntries(
    FIELDS.map((field) => [field, read(field)])
  ) as DigipayCallbackPayload
}

export async function POST(request: Request) {
  try {
    const payload = await readCallbackPayload(request)
    const result = await processDigipayCallback(payload)

    return redirectToReturnUrl(
      result.reference,
      result.status,
      result.returnUrl
    )
  } catch (error) {
    console.error(
      "Digipay callback processing failed.",
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

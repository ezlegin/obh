import { NextResponse } from "next/server"

import { processZarinpalCallback } from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

/** Zarinpal sends the customer back with `?Authority=...&Status=OK|NOK`. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams

  try {
    const result = await processZarinpalCallback({
      Authority: params.get("Authority"),
      Status: params.get("Status"),
    })

    return redirectToReturnUrl(
      result.reference,
      result.status,
      result.returnUrl
    )
  } catch (error) {
    console.error(
      "Zarinpal callback processing failed.",
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

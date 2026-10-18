import { NextResponse } from "next/server"

import { completeDevelopmentCheckout } from "@/server/payments/api-payment-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function redirectAfterCompletion(
  request: Request,
  token: string,
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
      // Fall through to the local result page if a stored URL became invalid.
    }
  }

  return NextResponse.redirect(
    new URL(`/pay/dev/${token}?result=${status.toLowerCase()}`, request.url),
    303
  )
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const formData = await request.formData()
  const outcome = formData.get("outcome")

  if (outcome !== "success" && outcome !== "failure") {
    return NextResponse.redirect(
      new URL(`/pay/dev/${token}?error=invalid`, request.url),
      303
    )
  }

  try {
    const result = await completeDevelopmentCheckout(token, outcome)

    return redirectAfterCompletion(
      request,
      token,
      result.reference,
      result.status,
      result.returnUrl
    )
  } catch (error) {
    console.error(
      "Development checkout completion failed.",
      error instanceof Error ? error.name : "Unknown error"
    )

    return NextResponse.redirect(
      new URL(`/pay/dev/${token}?error=checkout`, request.url),
      303
    )
  }
}

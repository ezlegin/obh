import type { Pay } from "./pay.js"
import type { PaymentRecord } from "./store.js"
import type { CheckoutRedirect } from "./types.js"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/**
 * Turns a checkout redirect into a web `Response`: a 303 for GET gateways and
 * a tiny auto-submitting form page for POST gateways (Mellat).
 */
export function redirectResponse(redirect: CheckoutRedirect): Response {
  if (redirect.method === "GET") {
    return new Response(null, {
      status: 303,
      headers: { Location: redirect.url, "Cache-Control": "no-store" },
    })
  }

  const fields = Object.entries(redirect.fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`
    )
    .join("")
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>انتقال به درگاه پرداخت</title></head><body style="font-family:sans-serif;text-align:center;padding:3rem"><p>در حال انتقال به درگاه پرداخت…</p><form id="f" method="post" action="${escapeHtml(redirect.url)}">${fields}<noscript><button type="submit">ادامه پرداخت</button></noscript></form><script>document.getElementById("f").submit()</script></body></html>`

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

/**
 * Reads a bank callback into a flat string map. Banks use GET queries, form
 * posts, or JSON; all three are merged, with the body winning over the query.
 */
export async function readCallbackPayload(
  request: Request
): Promise<Record<string, string>> {
  const payload: Record<string, string> = {}

  new URL(request.url).searchParams.forEach((value, key) => {
    payload[key] = value
  })

  if (request.method === "GET" || request.method === "HEAD") {
    return payload
  }

  const type = request.headers.get("content-type") ?? ""

  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    for (const [key, value] of Object.entries(body ?? {})) {
      if (value !== null && value !== undefined) {
        payload[key] = String(value)
      }
    }
  } else {
    const form = await request.formData().catch(() => null)
    form?.forEach((value, key) => {
      if (typeof value === "string") {
        payload[key] = value
      }
    })
  }

  return payload
}

export type CallbackRouteOptions = {
  /** Where to send the customer when the payment has no `returnUrl`. */
  fallbackUrl: string
  /** Query keys appended to the return URL. Defaults to reference + status. */
  buildQuery?: (payment: PaymentRecord) => Record<string, string>
  /** Called after the result is recorded, before redirecting. */
  onResult?: (payment: PaymentRecord) => void | Promise<void>
}

/**
 * Builds a ready-to-export route handler for one gateway's callback. In a
 * Next.js app: `export const GET = pay.callbackRoute("sadad", { ... })` or,
 * with a dynamic `[gateway]` segment, `callbackRoute(pay, gateway, options)`.
 *
 * The customer is always redirected (303) back to the service; the page they
 * land on must read the payment from your database, never from the URL.
 */
export function callbackRoute(
  pay: Pay,
  gateway: string,
  options: CallbackRouteOptions
) {
  return async (request: Request): Promise<Response> => {
    let target = options.fallbackUrl

    try {
      const payload = await readCallbackPayload(request)
      const { payment } = await pay.handleCallback(gateway, payload)
      await options.onResult?.(payment)

      const url = new URL(payment.returnUrl ?? options.fallbackUrl)
      const query = options.buildQuery?.(payment) ?? {
        reference: payment.reference,
        status: payment.status,
      }
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value)
      }
      target = url.toString()
    } catch (error) {
      const url = new URL(options.fallbackUrl)
      url.searchParams.set("status", "error")
      url.searchParams.set(
        "code",
        error instanceof Error && "code" in error
          ? String((error as { code: unknown }).code)
          : "UNKNOWN"
      )
      target = url.toString()
    }

    return new Response(null, {
      status: 303,
      headers: { Location: target, "Cache-Control": "no-store" },
    })
  }
}

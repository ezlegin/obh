# @obhco/pay

Take payments inside your own service with Iranian gateways — **Sadad**,
**Zarinpal**, **Mellat (Behpardakht)** and **Digipay** — and report every
payment to OBH for accounting, settlement tracking and reports.

Each service uses **its own gateway terminal and credentials**. Money settles
straight to the service's account; OBH never touches a bank, it only receives
the finance reports.

```
customer ──► your service ──► bank gateway
                 │  ▲              │
                 │  └── callback ──┘   (verified server-to-server)
                 ▼
               OBH  ◄── signed finance report (payment.snapshot)
```

Requires Node.js 20+, server-side only. Never ship gateway credentials or the
OBH service key to a browser.

## Install

```bash
pnpm add @obhco/pay
```

## 1. Storage

The package keeps no state of its own. You provide a `PaymentStore`; it needs
a table and a handful of lookups. `MemoryPaymentStore` is included for tests
and local development only.

Minimum table (adapt to your database):

| Column | Type | Notes |
| --- | --- | --- |
| `reference` | text, unique | `PAY-…` id of the attempt |
| `order_id` | text, indexed | your own order id |
| `attempt` | int | 1, 2, 3… per order |
| `gateway` | text | `sadad`, `zarinpal`, … |
| `gateway_order_id` | text | digits only, unique per gateway |
| `amount` | text/bigint | whole Rials |
| `status` | text | `pending` `completed` `failed` `cancelled` `expired` |
| `environment` | text | `live` or `test` |
| `provider_session_id` | text, indexed | token / authority / RefId |
| … | | the remaining fields of `PaymentRecord` |

Implement `PaymentStore` (see `src/store.ts`). The only subtle method is
`transition(reference, from, patch)`: it must update **only if the stored
status still equals `from`** and return `null` otherwise (for SQL:
`UPDATE … WHERE reference = ? AND status = ?` and check the row count). That
is what stops a double callback from completing a payment twice.

`nextGatewayOrderId(gateway)` must return a digits-only number that is unique
per gateway; a database sequence is ideal.

## 2. Configure

```ts
// lib/pay.ts
import { createPay } from "@obhco/pay"
import { store } from "./payment-store"

export const pay = createPay({
  service: "afarin", // short id, same as your OBH service slug
  baseUrl: "https://afarinai.ir", // your public origin (for bank callbacks)
  store,
  // gateways: ["zarinpal", "sadad"],  // default: every gateway with credentials
  // defaultGateway: "zarinpal",
})
```

Gateways are enabled by environment variables in **your** service:

| Gateway | Variables |
| --- | --- |
| Sadad | `SADAD_MERCHANT_ID`, `SADAD_TERMINAL_ID`, `SADAD_TERMINAL_KEY` (+ `SADAD_BASE_URL`, `SADAD_RELAY_URL`, `SADAD_RELAY_SECRET` if you call it through an Iranian relay) |
| Zarinpal | `ZARINPAL_MERCHANT_ID` (`ZARINPAL_SANDBOX=true` for the sandbox) |
| Mellat | `BEHPARDAKHT_TERMINAL_ID`, `BEHPARDAKHT_USERNAME`, `BEHPARDAKHT_PASSWORD` (+ `BEHPARDAKHT_RELAY_URL`, `BEHPARDAKHT_RELAY_SECRET`, `BEHPARDAKHT_CALLBACK_URL`) |
| Digipay | `DIGIPAY_USERNAME`, `DIGIPAY_PASSWORD`, and `DIGIPAY_AUTHORIZATION` or `DIGIPAY_CLIENT_ID` + `DIGIPAY_CLIENT_SECRET` (+ `DIGIPAY_BASE_URL`) |

Finance reporting to OBH:

| Variable | Value |
| --- | --- |
| `OBH_BASE_URL` | OBH origin, e.g. `https://obhco.ir` |
| `OBH_SERVICE_KEY` | Service credential (`keyId.secret`) created in OBH → Services |
| `PAY_ENVIRONMENT` | `test` while using sandbox terminals; default `live` |

If `OBH_BASE_URL` / `OBH_SERVICE_KEY` are missing, payments still work and
nothing is reported. Check the connection with `await pay.pingObh()`.

## 3. Start a payment

```ts
// app/api/checkout/route.ts (Next.js)
import { redirectResponse } from "@obhco/pay"
import { pay } from "@/lib/pay"

export async function POST(request: Request) {
  const { orderId, amount, gateway, mobile } = await request.json()

  const { redirect } = await pay.start({
    orderId, // your order id; one order can have several attempts
    amount, // whole Rials
    description: `Order ${orderId}`,
    gateway, // optional; see pay.listGateways()
    customerMobile: mobile, // required by Digipay
    returnUrl: `https://afarinai.ir/orders/${orderId}`,
  })

  return redirectResponse(redirect) // 303, or an auto-POST form for Mellat
}
```

`pay.listGateways()` returns what you can offer at checkout (Persian
`displayName`, `kind: "card" | "installment"`, `requiresCustomerMobile`).

Starting the same order twice returns the open session instead of creating a
second one, and an order that is already paid throws `ORDER_ALREADY_PAID`.

## 4. Receive the bank callback

```ts
// app/api/pay/[gateway]/callback/route.ts
import { callbackRoute } from "@obhco/pay"
import { pay } from "@/lib/pay"

async function handle(request: Request, ctx: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await ctx.params
  return callbackRoute(pay, gateway, {
    fallbackUrl: "https://afarinai.ir/checkout",
  })(request)
}

export { handle as GET, handle as POST }
```

The path must match `callbackPath` (default `/api/pay/{gateway}/callback`).
The handler finds the payment, **verifies it with the bank server-to-server**,
records the result and sends the customer back to `returnUrl` with
`?reference=…&status=completed|failed|pending`.

> Never trust that query string. On the page the customer lands on, load the
> payment with `pay.get(reference)` and fulfil the order only if
> `status === "completed"`.

## 5. Keep it healthy

Run `pay.reconcile()` every few minutes (cron, queue worker or a protected
route). It expires abandoned sessions, retries verifications that hit a
network error, and re-sends any report OBH has not acknowledged:

```ts
const { expired, reverified, reported } = await pay.reconcile()
```

Without it, a payment whose callback was lost stays pending, and OBH shows the
service as **stale** on its reports page.

## What OBH receives

For every state change the package sends one `payment.snapshot` (the full
state of one attempt) to `POST {OBH_BASE_URL}/api/v1/finance/events`,
authenticated with your service key. OBH upserts it by
`(service, reference)`, so retries and reordering are harmless; a failed
report never blocks the payment and is re-sent by `reconcile()`.

Sent: reference, order id, attempt, gateway, amount, status, timestamps, trace
and reference numbers, masked card, installment type (Digipay). **Not sent:**
customer mobile, return URL, or your `metadata` (opt in with
`report: { …, includeMetadata: true }`).

OBH then does the rest: accounting and revenue, per-service settlement
accounts per gateway, installment schedules for Digipay, reconciliation,
success rates by gateway and service, and stale-service alerts.

## Testing

* Use the gateways' own sandboxes (`ZARINPAL_SANDBOX=true`, bank test
  terminals) with `PAY_ENVIRONMENT=test`; test payments are kept out of
  OBH's financial totals.
* Unit tests can pass a fake adapter in `gateways: [...]` and a
  `MemoryPaymentStore`; see `tests/pay.test.ts` for a complete example.

## Errors

`PayError.code` is one of `INVALID_REQUEST`, `GATEWAY_NOT_AVAILABLE`,
`GATEWAY_ERROR`, `ORDER_ALREADY_PAID`, `PAYMENT_NOT_FOUND`, `ORDER_MISMATCH`,
`INVALID_CALLBACK`, `REPORT_FAILED`. Use `isPayError(error)` to branch on it.

## Security notes

* A callback is only a hint; the result always comes from the bank's verify
  call, and the verified amount must equal the stored amount (otherwise the
  payment is failed and flagged, never completed).
* Payments move `pending → final` exactly once (compare-and-set).
* Keep gateway credentials and `OBH_SERVICE_KEY` in server environment
  variables only.

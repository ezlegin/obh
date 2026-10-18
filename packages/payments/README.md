# @obh/payments

Server-side TypeScript SDK for the versioned OBH payment API.

> Status: **not published**. Version `0.1.0` is prepared for an internal review.
> It has been tested against the local OBH API and development adapter only. It
> has **not** been tested against a real payment provider.

## Install

```bash
pnpm add @obh/payments
```

The package is ESM, requires Node.js 20+, and must run on a server. Never ship a
service credential to a browser.

## Usage

```ts
import { OBHPayments, isOBHPaymentsError } from "@obh/payments"

const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: "https://pay.obh.example",
  timeoutMs: 15_000,
})

const payment = await obh.startPayment({
  externalOrderId: "IG-8821",
  amount: "245000000",
  currency: "IRR",
  description: "Annual design workspace",
  returnUrl: "https://igraphical.ir/payments/return",
  metadata: { plan: "annual" },
  // Reuse this key when retrying this exact request.
  idempotencyKey: "order-IG-8821-attempt-1",
})

if (payment.checkoutUrl) {
  // Redirect the customer to the provider checkout.
}

const latest = await obh.getPayment(payment.reference)
if (latest.status === "completed") {
  // Fulfill the order. Only the server-verified status is proof of payment.
}
```

## API

### `new OBHPayments(options)`

| Option      | Type           | Notes                                                    |
| ----------- | -------------- | -------------------------------------------------------- |
| `secretKey` | `string`       | Required service credential, `svc_...`. Server-only.     |
| `baseUrl`   | `string`       | OBH origin. HTTPS required except localhost development. |
| `timeoutMs` | `number`       | Optional request timeout, default 15 seconds.            |
| `fetch`     | `typeof fetch` | Optional custom fetch for tests/proxies.                 |

The constructor rejects execution when `window` is defined and rejects unsafe
base URLs. Browser-safe constants and types should be imported through a future
browser entrypoint; currently the package is server-only.

### `startPayment(input): Promise<Payment>`

Creates a payment through `POST /api/v1/payments`. If `idempotencyKey` is
omitted, a unique key is generated. Callers should provide and persist a key when
a request may need to be retried.

The API chooses the configured TEST provider account. Services never choose a
provider account or provide provider credentials.

### `getPayment(reference): Promise<Payment>`

Retrieves one payment through `GET /api/v1/payments/{reference}`. A service can
only retrieve its own payments.

## Statuses

`pending`, `completed`, `failed`, `cancelled`, `expired`.

`completed` is terminal and only set after server-side verification. A browser
redirect is not proof of payment. A `pending` payment may still change; poll with
backoff or rely on the configured webhook, then retrieve the authoritative status.

## Errors

All API failures are thrown as `OBHPaymentsError`:

```ts
try {
  await obh.startPayment(input)
} catch (error) {
  if (isOBHPaymentsError(error)) {
    console.error(error.code, error.status, error.requestId)
    if (error.code === "ORDER_CONFLICT") {
      // The external order already exists with different details.
    }
  }
}
```

Useful fields: `code`, `status`, `requestId`, `details`, `retryable`.
Transport failures use `NETWORK_ERROR`; timeouts use `TIMEOUT`; invalid API
responses use `INVALID_RESPONSE`.

Do not log `secretKey`, webhook signing secrets, or raw provider credentials.

## Webhooks

The SDK does not verify inbound webhooks. Connected services must verify the
`OBH-Signature` HMAC-SHA256 header with their own per-service webhook signing
secret over `<timestamp>.<raw body>`, reject stale timestamps, and deduplicate by
`OBH-Event-Id`. See [`../../apps/web/PAYMENT_API.md`](../../apps/web/PAYMENT_API.md).

## Development

```bash
pnpm --filter @obh/payments build
pnpm --filter @obh/payments typecheck
pnpm --filter @obh/payments test
pnpm --filter @obh/payments pack --dry-run
```

The local integration suite lives in `apps/web/tests/sdk-integration.ts` and
requires a running local OBH API plus its test database.

## Scope

The SDK does not contain provider adapters, provider secrets, database access,
webhook delivery, or Next.js dependencies. Provider integration remains
server-side in OBH. No real provider or live payment has been tested.

# OBH Payment API contract — v1

Status: **implemented in Step 6 for TEST credentials and the development
adapter.** The `@obhco/payments` SDK at version `0.1.0` is prepared but not
published. No real provider or live payment has been tested. LIVE credentials are
not issued.

This document defines the service-facing API and the behavior implemented by the
`@obhco/payments` package. Breaking changes require a new version.

## 1. Versioning and transport

- Base path: `/api/v1`
- Transport: HTTPS only in deployed environments.
- Content type: `application/json`
- Character encoding: UTF-8
- Timestamps: RFC 3339 UTC strings.
- IP/IRR amounts: decimal strings, never JavaScript numbers.
- Additive response fields are backward-compatible. Breaking changes require a
  new API version.
- API responses include a request identifier for support correlation.

## 2. Environments and credentials

Every connected service is identified by a server-managed credential issued in
OBH Admin.

Credential forms:

```text
TEST key:  svc_test_<key-id>.<secret>
LIVE key:  svc_live_<key-id>.<secret>
```

- The key ID is public. The secret is shown once at issuance and never stored in
  plaintext.
- OBH stores a SHA-256 digest of the high-entropy secret and compares it in
  constant time.
- Credentials are revocable. Revocation takes effect on the next request.
- TEST credentials are the only credentials issued until a live provider adapter
  is approved. TEST requests can never produce LIVE financial records.
- Authenticated requests use:

```http
Authorization: Bearer svc_test_<key-id>.<secret>
```

The credential identifies the service. A request cannot select a different
originating service. All queries and mutations are scoped to that service.

> Browser code must never receive a service secret. The SDK's privileged calls
> are server-only.

## 3. Payment objects

A service-visible payment contains:

```json
{
  "id": "018f...",
  "reference": "OBH-8B30F9C07A52D1E4",
  "service": "igraphical",
  "externalOrderId": "IG-8821",
  "amount": "245000000",
  "currency": "IRR",
  "environment": "test",
  "gateway": "sadad",
  "status": "pending",
  "description": "Annual design workspace",
  "checkoutUrl": null,
  "createdAt": "2026-10-18T08:00:00.000Z",
  "completedAt": null,
  "verifiedAt": null
}
```

Payment statuses:

| Status | Meaning | Terminal |
| --- | --- | --- |
| `pending` | Provider session exists or is being created; result unverified | No |
| `completed` | Server-side provider verification succeeded | Yes |
| `failed` | Verification or provider processing failed | Yes |
| `cancelled` | Payment was cancelled by an authorized process | Yes |
| `expired` | Checkout/session expired without success | Yes |

A terminal payment never transitions again. A browser redirect must never be
used as proof of success; only a server-side provider verification may produce
`completed`.

`gateway` is the code of the gateway processing the payment. Payments created
before gateway selection existed report `sadad`.

## 3a. List available gateways

```http
GET /api/v1/gateways?simulator=true|false
Authorization: Bearer <service credential>
```

Returns the gateways the service can offer on its checkout page, so the customer
can pick one (for example, a full card payment or installments).
`simulator=true` lists TEST gateways backed by the OBH simulators. Otherwise
only LIVE gateways whose credentials are configured on the server are listed,
so the list changes as OBH enables gateways. Do not hard-code it.

```json
{
  "data": [
    {
      "code": "sadad",
      "name": "Sadad (Bank Melli Iran)",
      "displayName": "پرداخت با کارت بانکی (سداد)",
      "description": "Pay in full with any Shetab bank card through Sadad (Bank Melli Iran).",
      "kind": "card",
      "requiresCustomerMobile": false,
      "minAmount": null,
      "isDefault": true,
      "environment": "live"
    },
    {
      "code": "digipay",
      "name": "Digipay (Installments / BNPL)",
      "displayName": "خرید اقساطی با دیجی‌پی",
      "description": "Buy now and pay later in installments with Digipay credit, or pay with a Digipay wallet or bank card.",
      "kind": "installment",
      "requiresCustomerMobile": true,
      "minAmount": null,
      "isDefault": false,
      "environment": "live"
    }
  ]
}
```

| Gateway | `kind` | Notes |
| --- | --- | --- |
| `sadad` | `card` | Default. Full payment with Shetab cards through Sadad (Bank Melli). |
| `digipay` | `installment` | Digipay UPG: BNPL, credit, wallet, or card. Requires `customer.mobile`. |

## 4. Create a payment

```http
POST /api/v1/payments
Authorization: Bearer <service credential>
Idempotency-Key: <unique request key>
Content-Type: application/json
```

Request body:

```json
{
  "externalOrderId": "IG-8821",
  "amount": "245000000",
  "currency": "IRR",
  "description": "Annual design workspace",
  "returnUrl": "https://igraphical.ir/payments/return",
  "metadata": {
    "plan": "annual"
  },
  "gateway": "digipay",
  "customer": {
    "mobile": "09121234567"
  }
}
```

Rules:

- `gateway` is optional and defaults to `sadad`. It must be a `code` returned
  by `GET /api/v1/gateways` for the same environment. An unknown code returns
  `422 GATEWAY_NOT_SUPPORTED`. A known gateway without LIVE credentials returns
  `503 GATEWAY_NOT_AVAILABLE`, or `503 LIVE_NOT_AVAILABLE` for Sadad.
- `customer.mobile` is required when the gateway has
  `requiresCustomerMobile: true` (Digipay). Otherwise the request returns
  `422 CUSTOMER_MOBILE_REQUIRED`. `+98…`, `98…` and `09…` forms are accepted.
- The gateway and mobile number are part of the request fingerprint, so
  replaying an idempotency key with a different gateway returns
  `409 IDEMPOTENCY_CONFLICT`.

- `externalOrderId` is required, 1–191 characters, and unique per service.
- `amount` is a positive decimal string with at most two decimal places.
- `currency` must be `IRR`. No implicit conversion is performed.
- `description` is required, up to 500 characters.
- `returnUrl` is optional. If omitted, the service's configured
  `defaultReturnUrl` is used. If neither exists, the request fails with
  `RETURN_URL_REQUIRED`.
- A supplied return URL must exactly match one of the service's
  `allowedReturnUrls`. Redirects and wildcards are not accepted.
- `metadata` is optional, must be a JSON object, must not contain secret
  credentials, and is limited to 8 KB. It is informational and must never affect
  authorization, amount, currency, or lifecycle decisions.
- `Idempotency-Key` is required and scoped to the authenticated service. Reusing
  a key with the same request returns the original payment. Reusing it with a
  different request returns `409 IDEMPOTENCY_CONFLICT`.
- Every accepted key is recorded in a service-scoped idempotency ledger, including
  a key that replays an existing external order. A consumed key cannot later be
  reused for a different financial request.
- Reusing an `externalOrderId` for an existing order returns the existing
  payment if the financial request matches; otherwise it returns
  `409 ORDER_CONFLICT`.
- OBH creates its own payment reference. Providers receive that reference only
  through server-side integration.

Success `201 Created`:

```json
{
  "data": {
    "id": "018f...",
    "reference": "OBH-8B30F9C07A52D1E4",
    "service": "igraphical",
    "externalOrderId": "IG-8821",
    "amount": "245000000",
    "currency": "IRR",
    "environment": "test",
    "status": "pending",
    "description": "Annual design workspace",
    "checkoutUrl": "https://provider.example/checkout/...",
    "createdAt": "2026-10-18T08:00:00.000Z"
  }
}
```

- First successful creation: `201`.
- Idempotent replay: `200`, with header `Idempotent-Replayed: true`.
- `checkoutUrl` is `null` for adapters that do not use a redirect. The current
  development adapter returns an absolute local checkout URL at
  `/pay/dev/<session>`.
- The development checkout is a simulation UI. Its POST result is processed by
  the server before redirecting, but connected services must still call
  `GET /api/v1/payments/{reference}` and must not treat the redirect as proof.

## 5. Retrieve a payment

```http
GET /api/v1/payments/{reference}
Authorization: Bearer <service credential>
```

- Returns only payments belonging to the authenticated service.
- Unknown references and references belonging to another service both return
  `404 PAYMENT_NOT_FOUND` to prevent cross-service enumeration.
- The response shape matches the payment object above.
- Status retrieval is authoritative only when the server has completed provider
  verification.

The SDK can poll this endpoint with backoff while a payment is `pending`. SDK
timeouts do not imply failure; the service must reconcile via this endpoint or
its webhook.

## 6. Errors

All errors use one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be validated.",
    "requestId": "req_...",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than zero."
      }
    ]
  }
}
```

Core codes:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Malformed or invalid request body |
| 401 | `AUTH_INVALID` | Missing, malformed, revoked, or invalid credential |
| 403 | `SERVICE_INACTIVE` | Service is deactivated |
| 404 | `PAYMENT_NOT_FOUND` | Not found in this service's scope |
| 409 | `IDEMPOTENCY_CONFLICT` | Same key used for a different request |
| 409 | `ORDER_CONFLICT` | External order already used with conflicting details |
| 409 | `PAYMENT_STATE_CONFLICT` | Invalid lifecycle operation |
| 413 | `PAYLOAD_TOO_LARGE` | Request body exceeds the size limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Request body is not JSON |
| 422 | `RETURN_URL_NOT_ALLOWED` | Return URL is not in the exact allowlist |
| 422 | `RETURN_URL_REQUIRED` | No return URL provided or configured |
| 422 | `GATEWAY_NOT_SUPPORTED` | `gateway` is not a gateway OBH offers |
| 422 | `CUSTOMER_MOBILE_REQUIRED` | The chosen gateway needs `customer.mobile` |
| 503 | `GATEWAY_NOT_AVAILABLE` | The chosen gateway has no LIVE credentials configured |
| 429 | `RATE_LIMITED` | Reserved for per-service rate limiting (not enforced yet) |
| 502 | `PROVIDER_ERROR` | Provider transport or response failure |
| 503 | `PROVIDER_UNAVAILABLE` | No active provider account/adapter |

Provider errors are sanitized before reaching the connected service.

## 7. Webhooks

Implemented for TEST payments when a service has both a webhook URL and a signing
secret.

- Destination: the service's configured `webhookUrl`.
- Method: `POST` with JSON.
- Events: `payment.completed` and `payment.failed`. Cancellation and expiry
  events remain reserved for a later lifecycle implementation.
- Each event has a stable `evt_...` ID and includes the OBH payment object.
- Signature headers:

```http
OBH-Event-Id: evt_...
OBH-Timestamp: 1760000000
OBH-Signature: t=1760000000,v1=<hex hmac>
```

- HMAC-SHA256 is calculated over `<timestamp>.<raw request body>` with a
  per-service webhook secret created or rotated in OBH Admin. It is separate from
  the API credential.
- The signing secret is encrypted at rest with a key derived from `AUTH_SECRET`
  using AES-256-GCM. Rotating `AUTH_SECRET` without rotating service webhook
  secrets will make existing secrets unreadable.
- A `2xx` response acknowledges delivery. Other responses and timeouts are
  retried with exponential backoff and jitter. The delivery row stores attempts,
  next attempt time, and a sanitized error.
- The first attempt is made immediately after the terminal payment update. A
  scheduled worker retries due deliveries:

```bash
pnpm --filter web webhooks:process
```

- Receivers must deduplicate by `OBH-Event-Id`.
- Older timestamps should be rejected by receivers after a small tolerance
  window.
- Delivered events are notifications: services should still retrieve the
  authoritative payment when reconciling.
- The worker is not yet scheduled automatically in this local environment.
  Production deployment must run it on a schedule.

The current schema records `WebhookDelivery` rows and retry fields. Delivery to
external endpoints has been tested only against a local receiver; real network,
TLS, and provider environments remain unverified.

## 8. Security model

1. **Service authentication.** Every service-to-server call carries a credential
   tied to exactly one active connected service.
2. **Isolation.** Payment reads and idempotency scopes always include the
   authenticated service. Cross-service access returns 404.
3. **Server-only secrets.** Provider credentials remain in server-side
   environment/secret-manager configuration. Service secrets are hashed.
4. **Server-side verification.** Provider callbacks/redirects are validated by
   the server adapter before a payment becomes `completed`.
5. **No redirect trust.** A browser return or query parameter cannot complete a
   payment.
6. **Input validation.** All external input is validated against a versioned Zod
   contract. Amounts, currencies, order IDs, return URLs, and metadata are
   bounded.
7. **Idempotency and duplicate prevention.** Database uniqueness enforces
   per-service idempotency keys and external order IDs. Provider callbacks are
   deduplicated by provider references and verified event history.
8. **Audit trail.** Payment events, verifications, and audit logs preserve the
   financial history. Completed records are not deleted.
9. **Test/live separation.** Payment records carry an environment, and TEST
   credentials/adapters cannot write LIVE records.
10. **Least privilege.** The admin UI is protected by an active-manager session;
    the service API will never accept an admin browser session as service
    authentication.

## 9. Provider integration boundary

Server-side adapters implement the `PaymentProviderAdapter` interface:

```ts
type PaymentProviderAdapter = {
  code: string
  descriptor: PaymentGatewayDescriptor // what GET /gateways exposes
  supportedEnvironments: ("TEST" | "LIVE")[]
  isLiveConfigured(): boolean
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>
}
```

Registered adapters (`server/payments/providers/registry.ts`):

| Code | Callback | TEST simulator | LIVE credentials |
| --- | --- | --- | --- |
| `sadad` | `POST /api/v1/sadad/callback` | `/pay/sadad/<token>` | `SADAD_MERCHANT_ID`, `SADAD_TERMINAL_ID`, `SADAD_TERMINAL_KEY` |
| `digipay` | `POST /api/v1/digipay/callback` | `/pay/digipay/<ticket>` | `DIGIPAY_USERNAME`, `DIGIPAY_PASSWORD`, `DIGIPAY_CLIENT_ID`, `DIGIPAY_CLIENT_SECRET` |

Digipay flow, following the Digipay UPG guide:

1. Log in with `POST oauth/token` (`grant_type=password`, Basic
   `client_id:client_secret`). The bearer token is cached until shortly before
   `expires_in`, and requested again once on a `401`.
2. Create a ticket with `POST tickets/business?type=11` and `amount`,
   `cellNumber`, `providerId` (the OBH `gatewayOrderId`), `callbackUrl` and a
   one-item `basketDetailsDto` (product type 3, service). Credit and BNPL
   purchases require the basket. The customer is redirected to the returned
   `redirectUrl`.
3. Digipay POSTs `result`, `trackingCode`, `providerId`, `amount` and `type` to
   the callback. OBH checks `providerId` and `amount` against the payment, then
   calls `POST purchases/verify?type=<type>` with the `trackingCode` and
   `providerId`. Purchases that are not verified are reversed by Digipay
   automatically.
4. Network failures and the retryable codes `9004`, `9006` and `9011` keep the
   payment `pending`. `GET /payments/{reference}` retries verify using the
   stored callback data.

Not implemented for Digipay yet: `purchases/deliver` (needed for CREDIT and
BNPL purchases after fulfilment), manual `reverse`, and `refunds`.

- Provider-specific imports, credentials, request signing, and response parsing
  stay under `server/payments/providers`.
- No provider SDK is imported by browser code or by `@obhco/payments`.
- Provider calls are not trusted merely because a request/redirect arrived.
- The development adapter is local-only, supports TEST only, never contacts a
  network, and explicitly marks its results as simulated. It is disabled in
  production builds unless `OBH_ENABLE_DEVELOPMENT_PROVIDER=true` is set in an
  approved test environment. See
  [`DEVELOPMENT_PAYMENTS.md`](DEVELOPMENT_PAYMENTS.md).
- A live adapter must be implemented and tested in an authorized environment
  before live credentials are issued.

## 10. Implementation status

Implemented:

- `POST /api/v1/payments` and `GET /api/v1/payments/{reference}`.
- Service Bearer authentication with hashed credentials, revocation, last-used
  timestamps, active-service checks, and TEST-only access.
- Exact return URL allowlists and service defaults.
- Per-service idempotency with request fingerprint conflict detection.
- External order duplicate detection.
- Provider checkout URL generation through the development adapter.
- Development checkout at `/pay/dev/<session>` with server-side verification.
- Scoped payment retrieval and cross-service 404 isolation.
- Payment lifecycle events, verification records, and audit logs.
- Signed webhook notifications, retry scheduling, delivery history, and worker.
- `@obhco/payments` 0.1.0: typed client, idempotency support, timeouts, typed
  errors, and server-only guard.
- Unit tests and a local API/SDK integration test covering isolation,
  idempotency, checkout completion, webhook signature verification, retry
  delivery, and revoked credentials.

Not implemented or not verified:

- LIVE credentials, live adapter, and real provider testing.
- Rate limiting and abuse controls.
- Automatic scheduling of the webhook retry worker.
- Cancellation and expiry notification events.
- Webhook secret recovery after loss; rotate the secret instead.
- Publishing future SDK versions; `0.1.0` is published on npm.
- The standalone documentation application.

The SDK must not be described as production-ready or integrated with a real
payment provider until an authorized environment test is completed.

## 11. SDK

Package: `@obhco/payments` version `0.1.0` at
[`packages/payments`](../../packages/payments).

```ts
import { OBHPayments } from "@obhco/payments"

const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: "https://pay.obh.example",
})

const payment = await obh.startPayment({
  externalOrderId: "IG-8821",
  amount: "245000000",
  description: "Annual design workspace",
  returnUrl: "https://igraphical.ir/payments/return",
  idempotencyKey: "order-IG-8821-attempt-1",
})

const status = await obh.getPayment(payment.reference)

// Checkout page: let the customer pick a gateway OBH currently offers.
const gateways = await obh.listGateways()
const installment = await obh.startPayment({
  externalOrderId: "IG-8822",
  amount: "245000000",
  description: "Annual design workspace",
  gateway: "digipay",
  customerMobile: "09121234567",
})
```

- The SDK is ESM, server-only, Node.js 20+, and depends on no database or
  provider package.
- `startPayment` sends the idempotency header and generates a key when the caller
  does not supply one.
- `getPayment` retrieves only the authenticated service's payment.
- Errors are `OBHPaymentsError` with `code`, `status`, `requestId`, `details`,
  and `retryable`.
- The SDK has not been published. It has been tested against the local API and
  development adapter, not a real provider.

See the package [README](../../packages/payments/README.md) for full usage and
security notes.

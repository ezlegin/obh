# OBH Payment API contract — v1

Status: **contract defined in Step 5; HTTP endpoints are implemented in Step 6.**
The admin payment console, connected-service registry, gateway foundation, and
development adapter are implemented now. The service-facing API and SDK are not
yet available.

This document defines the interface the `@obh/payments` SDK will call. It must be
kept in sync with the implementation and the SDK version.

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
  }
}
```

Rules:

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
- `checkoutUrl` is `null` for adapters that do not use a redirect (including the
  current admin-only development path). The SDK must represent this explicitly
  rather than inventing a URL.

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
| 422 | `RETURN_URL_NOT_ALLOWED` | Return URL is not in the exact allowlist |
| 422 | `RETURN_URL_REQUIRED` | No return URL provided or configured |
| 429 | `RATE_LIMITED` | Per-service rate limit exceeded |
| 502 | `PROVIDER_ERROR` | Provider transport or response failure |
| 503 | `PROVIDER_UNAVAILABLE` | No active provider account/adapter |

Provider errors are sanitized before reaching the connected service.

## 7. Webhooks

Planned for Step 6 alongside the API. They are not active yet.

- Destination: the service's configured `webhookUrl`.
- Method: `POST` with JSON.
- Events: `payment.completed`, `payment.failed`,
  `payment.cancelled`, `payment.expired`.
- Each event has a stable event ID and includes the OBH payment object.
- Signature headers:

```http
OBH-Event-Id: evt_...
OBH-Timestamp: 1760000000
OBH-Signature: t=1760000000,v1=<hex hmac>
```

- HMAC-SHA256 is calculated over `<timestamp>.<raw request body>` with a
  per-service webhook secret. The webhook secret is separate from the API
  credential and will be managed server-side with rotation support.
- A `2xx` response acknowledges delivery. Other responses and timeouts are
  retried with exponential backoff and jitter.
- Receivers must deduplicate by `OBH-Event-Id`.
- Older timestamps are rejected after a small tolerance window.
- Delivered events are attempts only: services should still retrieve the
  authoritative payment when reconciling.

The current schema records `WebhookDelivery` rows and retry fields; the delivery
worker and signing secret management are not implemented yet.

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
  supportedEnvironments: ("TEST" | "LIVE")[]
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>
}
```

- Provider-specific imports, credentials, request signing, and response parsing
  stay under `server/payments/providers`.
- No provider SDK is imported by browser code or by `@obh/payments`.
- Provider calls are not trusted merely because a request/redirect arrived.
- The development adapter is local-only, supports TEST only, never contacts a
  network, and explicitly marks its results as simulated.
- A live adapter must be implemented and tested in an authorized environment
  before live credentials are issued.

## 10. Step 5 implementation status

Implemented now:

- Connected-service registration with exact return URL allowlist and default
  return URL.
- One-time TEST credential issuance and revocation.
- Development gateway and TEST provider-account setup.
- Admin TEST payment creation through the development adapter.
- Payment lifecycle transitions, payment events, verification records, audit
  logs, and duplicate-protection constraints.
- Unit tests for lifecycle, credential hashing, and the development adapter.

Not implemented yet:

- HTTP `/api/v1` endpoints.
- `@obh/payments` SDK.
- Public service authentication middleware.
- Webhook signing and delivery worker.
- Real provider adapters.
- Login/API rate limiting and production deployment hardening.

The SDK will not be built until these contract details are approved.

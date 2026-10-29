# OBH finance API

OBH does **not** process payments. Each connected service takes payments with
`@obhco/pay` using its own bank-gateway terminal, and reports every payment to
OBH. OBH records them for accounting, settlement tracking, installment
schedules, reconciliation and reports.

The old hosted payment API (`POST /api/v1/payments`, `GET /api/v1/gateways`,
the `/pay/*` checkout pages, the bank callbacks and OBH webhooks) is retired.
`/api/v1/payments` answers `410 ENDPOINT_RETIRED`. The previous SDK,
`@obhco/payments`, only worked against that API and is deprecated; migrate the
service to `@obhco/pay` (see `packages/pay/README.md`).

## Authentication

Create a credential for the service in **Admin → Services**. It looks like
`keyId.secret`. Send it as a bearer token, server-side only:

```http
Authorization: Bearer <keyId.secret>
```

An invalid, revoked or inactive-service credential returns `401 AUTH_INVALID`
or `403 SERVICE_INACTIVE`.

## `GET /api/v1/finance/ping`

Confirms the credential works. Sends and stores nothing.

```json
{ "ok": true, "service": { "slug": "afarin", "name": "Afarin AI" } }
```

## `POST /api/v1/finance/events`

Content-Type `application/json`, max 32 KB. Send an `Idempotency-Key` header
(`@obhco/pay` uses `<reference>:<status>`); the body is idempotent on its own.

```json
{
  "type": "payment.snapshot",
  "eventId": "PAY-3F9A1C2B4D5E6F70:completed",
  "sentAt": "2026-10-29T10:15:00.000Z",
  "data": {
    "reference": "PAY-3F9A1C2B4D5E6F70",
    "orderId": "AF-8821",
    "attempt": 1,
    "gateway": "zarinpal",
    "gatewayOrderId": "1790000000001",
    "amount": "150000",
    "currency": "IRR",
    "status": "completed",
    "environment": "live",
    "description": "Pro subscription",
    "providerReference": "123456789",
    "traceNumber": "123456789",
    "maskedCardNumber": "502229******5995",
    "resultCode": 100,
    "resultText": "Verified",
    "installment": null,
    "createdAt": "2026-10-29T10:12:00.000Z",
    "callbackReceivedAt": "2026-10-29T10:14:40.000Z",
    "completedAt": "2026-10-29T10:14:41.000Z",
    "failedAt": null
  }
}
```

* `amount` is whole Rials as a digit string; `currency` is `IRR`.
* `status`: `pending` | `completed` | `failed` | `cancelled` | `expired`.
* `gateway`: `sadad` | `zarinpal` | `mellat` | `digipay`.
* `installment` (Digipay): `{ "purchaseType": "BNPL" | "CREDIT", "count": null }`.
  A completed payment with an installment creates the settlement schedule.
* `environment: "test"` payments are kept out of financial totals.
* `metadata` is accepted (≤ 8 KB) but `@obhco/pay` only sends it when the
  service opts in.

### Semantics

A snapshot is the **full state of one attempt**, upserted by
`(service, data.reference)`:

| Situation | Result |
| --- | --- |
| New reference | Payment created (`201`), settlement account for that service and gateway created on first use |
| Same status again | No change (`200`) |
| `pending` → final status | Payment updated, verification and event recorded (`200`) |
| Final payment, different status | `409 STATE_CONFLICT` |
| Same reference, different amount | `409 AMOUNT_CONFLICT` |
| Retry of an order | New `reference` with `attempt` ≥ 2; stored as `externalOrderId` `<orderId>~<attempt>` |

Response:

```json
{ "data": { "reference": "OBH-…", "status": "COMPLETED", "created": true, "changed": true } }
```

Errors use the usual envelope:
`{ "error": { "code", "message", "requestId", "details?" } }`.

## What appears in OBH

* **Payments**: every reported attempt, with the service and gateway.
* **Reconciliation**: one settlement account per service × gateway ×
  environment (`Sadad — Afarin AI (Live)`), so each terminal's balance can be
  reconciled against its own bank statement.
* **Reports**: revenue by service, **gateways by service** (attempts, success
  rate, volume) and **service reporting health** (last report, stale pending).
* **Dashboard alert** when a service has payments stuck pending for over two
  hours (its `pay.reconcile()` job is not running).
* **API logs**: every report call, with request id and outcome.

## Local development

OBH has no payment simulator any more. Develop services against the gateways'
own sandboxes (for example `ZARINPAL_SANDBOX=true`) with
`PAY_ENVIRONMENT=test`. Test payments can be removed from **Admin → Payments**.

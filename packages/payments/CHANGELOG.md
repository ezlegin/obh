# @obhco/payments changelog

## Deprecated

The hosted OBH payment API was retired, so this package no longer has a
backend to talk to. Use `@obhco/pay` inside your service instead.

## 0.2.0 — unreleased

- Added `listGateways()` (`GET /api/v1/gateways`) so checkout pages can list
  the gateways OBH offers and let the customer choose one.
- Added `gateway` and `customerMobile` to `startPayment`. Digipay installments
  (`"digipay"`) require `customerMobile`. The default gateway stays Sadad.
- Added the Zarinpal card gateway (`"zarinpal"`, minimum 10,000 R).
- Added the Mellat (Behpardakht) card gateway (`"mellat"`).
- Added `payment.gateway`. Responses from servers without the field are still
  accepted.
- Added `PaymentGateway`, `PaymentGatewayCode`, `PaymentGatewayKind`, and
  `ListGatewaysOptions` types.
- Additive, backward-compatible release. Requires the OBH API with gateway
  support for `gateway`, `customerMobile`, and `listGateways()`.
- Digipay has been tested only against the OBH simulator, not the real Digipay
  UPG.

## 0.1.0 — 2026-10-27

First public release on npm as `@obhco/payments`.

- Added `OBHPayments` with `startPayment` and `getPayment`.
- Added automatic or caller-supplied idempotency keys.
- Added typed error handling with codes, status, request IDs, details, and
  retryability.
- Added request timeouts and network error handling.
- Added HTTPS enforcement, localhost development support, and a browser
  execution guard.
- Added TypeScript declarations and ESM output.
- Tested against the local OBH API and development adapter, including
  cross-service isolation, signed webhooks, retry delivery, and revoked
  credentials.
- Not tested against a real payment provider. Not production-ready.

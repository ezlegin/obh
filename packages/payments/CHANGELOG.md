# @obhco/payments changelog

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

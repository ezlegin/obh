# @obh/payments — reserved scaffold

This directory reserves the workspace boundary for the reusable OBH payment
SDK. It is intentionally empty of implementation.

- The package name is provisional and must be confirmed before SDK work begins.
- No public exports, API client, provider logic, credentials, or verification
  code exists here yet.
- SDK implementation belongs to an explicitly authorized later step.
- Privileged credentials and trusted payment verification must remain
  server-side; this package must never expose them to browser code.

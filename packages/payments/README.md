# @obhco/payments

Server-side TypeScript SDK for the versioned OBH payment API.

## Install

```bash
pnpm add @obhco/payments
```

The package is ESM, requires Node.js 20+, and must run on a server. Never ship a
service credential to a browser.

## Usage

```ts
import { OBHPayments, isOBHPaymentsError } from "@obhco/payments"

const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: "https://obhco.ir",
  timeoutMs: 15_000,
})

// 1. Start a payment on your backend (amount in whole Rials, no decimals)
const payment = await obh.startPayment({
  externalOrderId: "AF-8821",
  amount: "150000",
  currency: "IRR",
  description: "Pro subscription",
  returnUrl: "https://afarinai.ir/payments/return",
  metadata: { plan: "pro" },
  idempotencyKey: "order-AF-8821-attempt-1",
})

if (payment.checkoutUrl) {
  // 2. Redirect the customer's browser to payment.checkoutUrl
}

// 3. When the customer returns to your returnUrl, verify server-to-server:
const verified = await obh.verifyReturn(request.url, {
  expectedOrderId: "AF-8821",
  expectedAmount: "150000",
})

if (verified.status === "completed") {
  // Fulfill the order and display receipt fields:
  // verified.receipt.orderNumber
  // verified.receipt.traceNumber (SystemTraceNo)
  // verified.receipt.referenceNumber (RetrivalRefNo)
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

### `startPayment(input): Promise<Payment>`

Creates a payment through `POST /api/v1/payments`. `amount` must be a positive
whole Rial integer string without decimals (e.g. `"150000"`).

### `getPayment(reference): Promise<Payment>`

Retrieves one payment through `GET /api/v1/payments/{reference}`. A service can
only retrieve its own payments.

### `verifyReturn(returnInput, options?): Promise<Payment>`

Extracts `obh_reference` from the customer's return URL or query parameters,
fetches the authoritative server-verified payment from OBH, and optionally
asserts `expectedOrderId` and `expectedAmount`.

## Receipt fields (`payment.receipt`)

- `orderNumber`: Gateway numeric order ID (`OrderId`)
- `traceNumber`: Transaction tracking number (`SystemTraceNo`)
- `referenceNumber`: Transaction reference number (`RetrivalRefNo`)
- `maskedCardNumber`: Masked card number (`PrimaryAccNo`)
- `resultCode`: Gateway response code (`ResCode`)
- `resultMessage`: Gateway response description (`Description`)

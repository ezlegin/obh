# @obhco/payments (deprecated)

> **Deprecated.** OBH no longer hosts payments; the API this SDK calls
> (`/api/v1/payments`) now returns `410`. Use [`@obhco/pay`](../pay) inside
> your service instead.

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

## Letting customers choose a gateway

OBH offers more than one gateway. Sadad (`"sadad"`) takes a full bank card
payment, and Digipay (`"digipay"`) lets the customer pay in installments
(BNPL/credit). List them on your checkout page instead of hard-coding them, so
new gateways show up automatically:

```ts
// Server: load the options for your checkout page
const gateways = await obh.listGateways()
// [{ code: "sadad", displayName: "پرداخت با کارت بانکی (سداد)", kind: "card", isDefault: true, ... },
//  { code: "digipay", displayName: "خرید اقساطی با دیجی‌پی", kind: "installment", requiresCustomerMobile: true, ... }]

// Server: start the payment with the gateway the customer picked
const payment = await obh.startPayment({
  externalOrderId: "AF-8822",
  amount: "15000000",
  description: "Pro subscription (yearly)",
  gateway: selected.code,
  // Required when the gateway has requiresCustomerMobile (Digipay)
  customerMobile: selected.requiresCustomerMobile ? "09121234567" : undefined,
})
```

Verification is the same for every gateway: call `verifyReturn` or
`getPayment` and trust only `payment.status`. `payment.gateway` reports which
gateway processed the payment.

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
whole Rial integer string without decimals (e.g. `"150000"`). Optional
`gateway` selects a gateway from `listGateways()` (default `"sadad"`).
`customerMobile` is required for gateways with `requiresCustomerMobile`.

### `listGateways(options?): Promise<PaymentGateway[]>`

Lists the gateways OBH currently offers through `GET /api/v1/gateways`. Each
item has `code`, `name`, Persian `displayName`, `description`, `kind` (`"card"`
or `"installment"`), `requiresCustomerMobile`, `minAmount` and `isDefault`.
`{ simulator: true }` lists the TEST simulators. The default comes from the
client's `simulator` option.

### `getPayment(reference): Promise<Payment>`

Retrieves one payment through `GET /api/v1/payments/{reference}`. A service can
only retrieve its own payments.

### `verifyReturn(returnInput, options?): Promise<Payment>`

Extracts `obh_reference` from the customer's return URL or query parameters,
fetches the authoritative server-verified payment from OBH, and optionally
asserts `expectedOrderId` and `expectedAmount`.

## Receipt fields (`payment.receipt`)

| Field              | Sadad           | Digipay                     |
| ------------------ | --------------- | --------------------------- |
| `orderNumber`      | `OrderId`       | `providerId`                |
| `traceNumber`      | `SystemTraceNo` | `rrn` (card purchases only) |
| `referenceNumber`  | `RetrivalRefNo` | `trackingCode`              |
| `maskedCardNumber` | `PrimaryAccNo`  | `maskedPan`                 |
| `resultCode`       | `ResCode`       | `result.status`             |
| `resultMessage`    | `Description`   | `result.message`            |

import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/docs/callout"
import { CodeBlock } from "@/components/docs/code-block"
import { DocPage } from "@/components/docs/doc-page"
import { Endpoint } from "@/components/docs/content"
import { Table } from "@/components/docs/table"

export const metadata: Metadata = {
  title: "API reference",
  description:
    "Complete reference for the SDK surface and the underlying OBH payment HTTP API.",
}

const sections = [
  { id: "sdk-surface", title: "SDK surface" },
  { id: "types", title: "TypeScript types" },
  { id: "http-api", title: "HTTP API" },
  { id: "create-endpoint", title: "Create endpoint" },
  { id: "retrieve-endpoint", title: "Retrieve endpoint" },
  { id: "error-envelope", title: "Error envelope" },
  { id: "versioning", title: "Versioning" },
]

export default function ApiReferencePage() {
  return (
    <DocPage
      href="/docs/api-reference"
      eyebrow="Reference"
      title="API reference"
      description={
        <>
          The SDK is a thin, typed layer over two HTTP endpoints. This page is
          the exhaustive reference for both layers — useful when you need a
          detail, or when you cannot use the SDK.
        </>
      }
      sections={sections}
    >
      <h2 id="sdk-surface">SDK surface</h2>

      <CodeBlock
        language="ts"
        code={`// Package exports
export { OBHPayments } from "@obhco/payments"
export { OBHPaymentsError, isOBHPaymentsError } from "@obhco/payments"
export type {
  APIErrorDetail,
  APIErrorEnvelope,
  ListGatewaysOptions,
  OBHPaymentsOptions,
  Payment,
  PaymentEnvironment,
  PaymentGateway,
  PaymentGatewayCode,
  PaymentGatewayKind,
  PaymentReceipt,
  PaymentStatus,
  StartPaymentInput,
  VerifyReturnInput,
} from "@obhco/payments"`}
      />

      <h3>Class OBHPayments</h3>

      <div className="not-prose my-4 overflow-hidden rounded-xl border border-white/10">
        {[
          {
            signature: "new OBHPayments(options)",
            body: "Validates configuration and creates a reusable client targeting https://obhco.ir/api/v1. Throws if run in a browser.",
            href: "/docs/configuration",
          },
          {
            signature: "startPayment(input): Promise<Payment>",
            body: "Creates a payment. Sends POST https://obhco.ir/api/v1/payments with an idempotency key.",
            href: "/docs/payments/create",
          },
          {
            signature: "listGateways(options?): Promise<PaymentGateway[]>",
            body: "Lists the gateways OBH offers for your checkout page. Sends GET https://obhco.ir/api/v1/gateways.",
            href: "/docs/gateways",
          },
          {
            signature: "getPayment(reference): Promise<Payment>",
            body: "Retrieves one payment. Sends GET https://obhco.ir/api/v1/payments/{reference}.",
            href: "/docs/payments/retrieve",
          },
          {
            signature: "verifyReturn(input): Promise<Payment>",
            body: "Extracts the reference from return query params or a return URL and calls getPayment(reference).",
            href: "/docs/payments/retrieve",
          },
        ].map((method, index) => (
          <div
            key={method.signature}
            className={`px-4 py-3.5 ${
              index > 0 ? "border-t border-white/[0.07]" : ""
            }`}
          >
            <Link
              href={method.href}
              className="font-mono text-[0.78rem] text-foreground underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
            >
              {method.signature}
            </Link>
            <p className="mt-1 text-[0.78rem] text-muted-foreground">
              {method.body}
            </p>
          </div>
        ))}
      </div>

      <h3>Class OBHPaymentsError</h3>
      <CodeBlock
        language="ts"
        code={`class OBHPaymentsError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId?: string
  readonly details?: APIErrorDetail[]
  readonly retryable: boolean
  cause?: unknown
}

function isOBHPaymentsError(error: unknown): error is OBHPaymentsError`}
      />

      <h2 id="types">TypeScript types</h2>
      <CodeBlock
        filename="@obhco/payments"
        language="ts"
        code={`type PaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"

type PaymentEnvironment = "test" | "live"

type PaymentGatewayCode = "sadad" | "digipay" | (string & {})

type PaymentGatewayKind = "card" | "installment"

type PaymentGateway = {
  code: PaymentGatewayCode
  name: string
  displayName: string // Persian label for checkout
  description: string
  kind: PaymentGatewayKind
  requiresCustomerMobile: boolean
  minAmount: string | null
  isDefault: boolean
  environment: PaymentEnvironment
}

type ListGatewaysOptions = {
  simulator?: boolean
}

type PaymentReceipt = {
  orderNumber: string | null
  traceNumber: string | null
  referenceNumber: string | null
  maskedCardNumber: string | null
  resultCode: string | null
  resultMessage: string | null
}

type Payment = {
  id: string
  reference: string
  service: string
  externalOrderId: string | null
  amount: string
  currency: string
  environment: PaymentEnvironment
  gateway: PaymentGatewayCode
  status: PaymentStatus
  description: string
  checkoutUrl: string | null
  receipt: PaymentReceipt
  createdAt: string
  completedAt: string | null
  verifiedAt: string | null
}

type StartPaymentInput = {
  externalOrderId: string
  amount: string
  currency?: "IRR"
  description: string
  returnUrl?: string
  metadata?: Record<string, unknown>
  gateway?: PaymentGatewayCode // default "sadad"
  customerMobile?: string // required by Digipay
  idempotencyKey?: string
  simulator?: boolean
}

type VerifyReturnInput =
  | string
  | URL
  | URLSearchParams
  | Record<string, string | string[] | undefined>

type OBHPaymentsOptions = {
  secretKey: string
  /** Optional override. Defaults to "https://obhco.ir/api/v1". */
  baseUrl?: string
  timeoutMs?: number
  fetch?: typeof fetch
  simulator?: boolean
}

type APIErrorDetail = {
  field?: string
  message: string
}

type APIErrorEnvelope = {
  error?: {
    code?: string
    message?: string
    requestId?: string
    details?: APIErrorDetail[]
  }
}`}
      />

      <Callout
        variant="tip"
        title="Runtime validation is intentionally shallow"
      >
        <p>
          The SDK checks that a successful response looks like a{" "}
          <code>Payment</code> — required strings, a known status, a known
          environment. It does not do full schema validation. Unknown fields are
          passed through and should be ignored.
        </p>
      </Callout>

      <h2 id="http-api">HTTP API</h2>
      <p>
        Base URL: <code>https://obhco.ir/api/v1</code>. Transport is HTTPS and
        content is UTF-8 JSON.
      </p>

      <Table
        head={
          <>
            <th>Header</th>
            <th>Value</th>
            <th>Notes</th>
          </>
        }
      >
        <tr>
          <td>
            <code>Authorization</code>
          </td>
          <td>
            <code>Bearer svc_...</code>
          </td>
          <td>Required on every request.</td>
        </tr>
        <tr>
          <td>
            <code>Content-Type</code>
          </td>
          <td>
            <code>application/json</code>
          </td>
          <td>Required for POST.</td>
        </tr>
        <tr>
          <td>
            <code>Accept</code>
          </td>
          <td>
            <code>application/json</code>
          </td>
          <td>Set by the SDK.</td>
        </tr>
        <tr>
          <td>
            <code>Idempotency-Key</code>
          </td>
          <td>1–191 printable ASCII characters</td>
          <td>Required for POST; scoped to the service.</td>
        </tr>
        <tr>
          <td>
            <code>User-Agent</code>
          </td>
          <td>
            <code>@obhco/payments/0.2.0</code>
          </td>
          <td>Set by the SDK for diagnostics.</td>
        </tr>
      </Table>

      <p>
        Responses include a request identifier for support correlation. Errors
        use a single envelope, described below.
      </p>

      <h2 id="create-endpoint">Create endpoint</h2>
      <Endpoint method="POST" path="/api/v1/payments" />

      <CodeBlock
        filename="Request"
        language="json"
        code={`{
  "externalOrderId": "IG-8821",
  "amount": "245000000",
  "currency": "IRR",
  "description": "Annual design workspace",
  "returnUrl": "https://igraphical.ir/payments/return",
  "metadata": { "plan": "annual" },
  "gateway": "sadad"
}`}
      />

      <CodeBlock
        filename="201 Created"
        language="json"
        code={`{
  "data": {
    "id": "018f0000-0000-7000-8000-000000000001",
    "reference": "OBH-8B30F9C07A52D1E4",
    "service": "igraphical",
    "externalOrderId": "IG-8821",
    "amount": "245000000",
    "currency": "IRR",
    "environment": "live",
    "gateway": "sadad",
    "status": "pending",
    "description": "Annual design workspace",
    "checkoutUrl": "https://sadad.shaparak.ir/VPG/Purchase?Token=...",
    "receipt": {
      "orderNumber": "1042",
      "traceNumber": null,
      "referenceNumber": null,
      "maskedCardNumber": null,
      "resultCode": "0",
      "resultMessage": null
    },
    "createdAt": "2026-10-18T08:00:00.000Z",
    "completedAt": null,
    "verifiedAt": null
  }
}`}
      />

      <ul>
        <li>
          <strong>201</strong> — a new payment was created.
        </li>
        <li>
          <strong>200</strong> — idempotent replay. The response includes{" "}
          <code>Idempotent-Replayed: true</code>.
        </li>
        <li>
          <code>checkoutUrl</code> may be <code>null</code> when the adapter
          does not use a redirect.
        </li>
        <li>
          Pass <code>"simulator": true</code> (or set{" "}
          <code>OBH_SIMULATOR="true"</code> when using the SDK) to route the
          payment to the OBH Sadad simulator instead of the live Sadad IPG.
        </li>
        <li>
          <code>gateway</code> is optional and defaults to <code>"sadad"</code>.
          Use a code from <code>GET /api/v1/gateways</code>. Digipay (
          <code>"digipay"</code>) also needs{" "}
          <code>{'"customer": { "mobile": "09121234567" }'}</code>. See{" "}
          <Link href="/docs/gateways">Gateways &amp; installments</Link>.
        </li>
        <li>
          The OBH reference is generated by OBH and sent to the provider only
          through server-side integration.
        </li>
      </ul>

      <CodeBlock
        filename="curl"
        language="bash"
        code={`curl -sS https://obhco.ir/api/v1/payments \\
  -H "Authorization: Bearer $OBH_SERVICE_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-IG-8821-attempt-1" \\
  -d '{
    "externalOrderId": "IG-8821",
    "amount": "245000000",
    "currency": "IRR",
    "description": "Annual design workspace"
  }'`}
      />

      <h2 id="retrieve-endpoint">Retrieve endpoint</h2>
      <Endpoint method="GET" path="/api/v1/payments/{reference}" />

      <CodeBlock
        filename="200 OK"
        language="json"
        code={`{
  "data": {
    "reference": "OBH-8B30F9C07A52D1E4",
    "status": "completed",
    "completedAt": "2026-10-18T08:04:10.000Z",
    "verifiedAt": "2026-10-18T08:04:10.000Z"
  }
}`}
      />

      <ul>
        <li>Returns only payments belonging to the authenticated service.</li>
        <li>
          Unknown references and other services’ references both return{" "}
          <code>404 PAYMENT_NOT_FOUND</code>.
        </li>
        <li>
          The status is authoritative only after server-side provider
          verification.
        </li>
        <li>
          The SDK encodes the reference before building the URL. Encode it
          yourself if you call the API directly.
        </li>
      </ul>

      <h2 id="error-envelope">Error envelope</h2>
      <CodeBlock
        filename="Any non-2xx"
        language="json"
        code={`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be validated.",
    "requestId": "req_01J9Z6K3T4QW8M2",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than zero."
      }
    ]
  }
}`}
      />

      <p>
        The SDK maps this envelope to <code>OBHPaymentsError</code>. See{" "}
        <Link href="/docs/errors">Errors</Link> for every code and the retry
        rules.
      </p>

      <h2 id="versioning">Versioning</h2>
      <ul>
        <li>
          The base path carries the major version: <code>/api/v1</code>.
        </li>
        <li>
          Adding response fields is backward-compatible and does not require a
          new version.
        </li>
        <li>Breaking changes require a new API version.</li>
        <li>
          The SDK version is independent of the API version. Package{" "}
          <code>0.1.0</code> targets API <code>v1</code>.
        </li>
      </ul>

      <Callout variant="note" title="Not implemented yet">
        <p>
          There is no endpoint for cancellation, refunds, captures, or listing
          payments. Do not design around them. Rate limiting is reserved (
          <code>429</code>) but not enforced.
        </p>
      </Callout>
    </DocPage>
  )
}

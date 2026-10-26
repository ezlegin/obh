import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { Endpoint } from "@/components/content"
import { PropsTable, Table } from "@/components/table"

export const metadata: Metadata = {
  title: "Create a payment",
  description:
    "Reference for startPayment: inputs, validation rules, idempotency, and the payment it returns.",
}

const sections = [
  { id: "signature", title: "Signature" },
  { id: "inputs", title: "Inputs" },
  { id: "validation-rules", title: "Validation rules" },
  { id: "return-url", title: "Return URLs" },
  { id: "metadata", title: "Metadata" },
  { id: "idempotency", title: "Idempotency" },
  { id: "what-you-get-back", title: "What you get back" },
  { id: "complete-example", title: "Complete example" },
  { id: "errors", title: "Errors from creation" },
]

export default function CreatePaymentPage() {
  return (
    <DocPage
      href="/payments/create"
      eyebrow="Building"
      title="Create a payment"
      description={
        <>
          <code>startPayment()</code> creates a payment record, asks OBH to
          open a provider session, and returns everything you need to send the
          customer to checkout. It is safe to retry when you use a stable
          idempotency key.
        </>
      }
      sections={sections}
    >
      <h2 id="signature">Signature</h2>
      <CodeBlock
        language="ts"
        code={`class OBHPayments {
  startPayment(input: StartPaymentInput): Promise<Payment>
}`}
      />

      <Endpoint method="POST" path="/api/v1/payments" />

      <p>
        The method validates the input locally, adds your credential and an
        idempotency header, retries nothing on its own, and resolves to the
        created (or replayed) payment.
      </p>

      <h2 id="inputs">Inputs</h2>
      <PropsTable
        rows={[
          {
            name: "externalOrderId",
            type: "string",
            required: true,
            description:
              "Your order identifier. 1–191 characters and unique per service. Echoed back on every payment.",
          },
          {
            name: "amount",
            type: "string",
            required: true,
            description:
              "Positive integer string in Iranian Rials (IRR), 1–18 digits. Never a JavaScript number.",
          },
          {
            name: "currency",
            type: '"IRR"',
            required: false,
            defaultValue: '"IRR"',
            description:
              "The only supported currency. Any other value is rejected locally.",
          },
          {
            name: "description",
            type: "string",
            required: true,
            description:
              "What the customer is paying for. 1–500 characters after trimming; shown in dashboards and receipts.",
          },
          {
            name: "returnUrl",
            type: "string",
            required: false,
            description:
              "Absolute http(s) URL the customer returns to. Must match the service allowlist exactly. Defaults to the service’s configured return URL.",
          },
          {
            name: "metadata",
            type: "Record<string, unknown>",
            required: false,
            description:
              "Informational JSON object, serialized to at most 8 KB. Never used for authorization or amounts.",
          },
          {
            name: "idempotencyKey",
            type: "string",
            required: false,
            description:
              "1–191 visible ASCII characters. Reuse it when retrying the same request. Generated as sdk_<uuid> when omitted.",
          },
          {
            name: "simulator",
            type: "boolean",
            required: false,
            defaultValue: "process.env.OBH_SIMULATOR === 'true'",
            description:
              "When true, routes the payment to the OBH Sadad simulator instead of the live Sadad IPG.",
          },
        ]}
      />

      <h2 id="validation-rules">Validation rules</h2>
      <p>
        The SDK validates before making a network request, so most mistakes
        surface as an <code>INVALID_ARGUMENT</code> error without touching the
        API. The API validates again — never assume the local checks are the
        full contract.
      </p>

      <Table
        head={
          <>
            <th>Field</th>
            <th>Rule enforced by the SDK</th>
          </>
        }
      >
        <tr>
          <td>
            <code>externalOrderId</code>
          </td>
          <td>Non-empty, at most 191 characters.</td>
        </tr>
        <tr>
          <td>
            <code>amount</code>
          </td>
          <td>
            Matches <code>^\d&#123;1,18&#125;$</code> (whole Iranian Rials) and
            is greater than zero. Leading zeros, decimals, and <code>"0"</code>{" "}
            are rejected.
          </td>
        </tr>
        <tr>
          <td>
            <code>currency</code>
          </td>
          <td>
            Must be <code>"IRR"</code> when provided.
          </td>
        </tr>
        <tr>
          <td>
            <code>description</code>
          </td>
          <td>Non-empty after trimming, at most 500 characters.</td>
        </tr>
        <tr>
          <td>
            <code>returnUrl</code>
          </td>
          <td>
            Must parse as an absolute URL with an <code>http:</code> or{" "}
            <code>https:</code> protocol. Allowlisting happens on the API.
          </td>
        </tr>
        <tr>
          <td>
            <code>metadata</code>
          </td>
          <td>
            Must be a plain JSON object (not an array, not null), at most 8 KB
            when serialized.
          </td>
        </tr>
        <tr>
          <td>
            <code>idempotencyKey</code>
          </td>
          <td>1–191 printable ASCII characters (no spaces or control characters).</td>
        </tr>
      </Table>

      <CodeBlock
        filename="Valid and invalid inputs"
        language="ts"
        code={`// Valid
await obh.startPayment({
  externalOrderId: "IG-8821",
  amount: "245000000",
  description: "Annual design workspace",
})

// Invalid: amount is a number
await obh.startPayment({ amount: 245000000 /* ... */ })

// Invalid: zero
await obh.startPayment({ amount: "0" /* ... */ })

// Invalid: decimals (IRR amounts are whole integers)
await obh.startPayment({ amount: "10.99" /* ... */ })`}
      />

      <h2 id="return-url">Return URLs</h2>
      <p>
        The return URL is where the provider sends the customer after checkout.
        OBH only redirects to an exact match from the service allowlist; there
        is no wildcard or prefix matching.
      </p>
      <ul>
        <li>If you omit <code>returnUrl</code>, the service’s default is used.</li>
        <li>
          If neither exists, the API fails with{" "}
          <code>RETURN_URL_REQUIRED</code>.
        </li>
        <li>
          If the URL is not on the allowlist, the API fails with{" "}
          <code>RETURN_URL_NOT_ALLOWED</code>.
        </li>
      </ul>
      <p>
        Use a URL on your own origin and verify the payment server-side when it
        loads. Never put a status or amount in the return URL and trust it when
        it comes back.
      </p>

      <Callout variant="note" title="Which return URL should I send?">
        <p>
          Send the exact absolute URL you registered, including protocol and
          trailing slash behavior. A mismatch in either is a mismatch.
        </p>
      </Callout>

      <h2 id="metadata">Metadata</h2>
      <p>
        Metadata is a small JSON object attached to the payment for your own
        reference — a plan name, an internal user id, a campaign, or a
        correlation id. It is informational only.
      </p>
      <CodeBlock
        language="ts"
        code={`metadata: {
  plan: "annual",
  seats: 12,
  campaign: "autumn-2026",
  internalUserId: "usr_9f2c",
}`}
      />

      <Callout variant="warning" title="Never put secrets in metadata">
        <p>
          Metadata is stored and visible to OBH operators and support tooling.
          Do not include credentials, access tokens, card data, or anything you
          would not put in an email. It must never influence authorization,
          amount, currency, or lifecycle decisions.
        </p>
      </Callout>

      <h2 id="idempotency">Idempotency</h2>
      <p>
        Every create request carries an <code>Idempotency-Key</code> header. If
        you provide one, the SDK uses it verbatim. If you omit it, the SDK
        generates <code>sdk_&lt;uuid&gt;</code> — fine for a single attempt, but
        useless for a retry, because the next call gets a different key.
      </p>
      <CodeBlock
        language="ts"
        code={`const payment = await obh.startPayment({
  externalOrderId: order.id,
  amount: order.total,
  description: order.title,
  // Stable for this attempt, persisted before the request.
  idempotencyKey: \`order-\${order.id}-attempt-\${attempt}\`,
})`}
      />
      <p>
        Reusing a key with an identical request returns the original payment.
        Reusing it with a different request returns{" "}
        <code>409 IDEMPOTENCY_CONFLICT</code>. The full rules and retry
        strategy live in{" "}
        <Link href="/idempotency">Idempotency &amp; retries</Link>.
      </p>

      <h2 id="what-you-get-back">What you get back</h2>
      <p>
        A resolved promise is a <code>Payment</code> object. The fields you
        will use most:
      </p>
      <CodeBlock
        filename="Payment"
        language="json"
        code={`{
  "id": "018f0000-0000-7000-8000-000000000001",
  "reference": "OBH-8B30F9C07A52D1E4",
  "service": "igraphical",
  "externalOrderId": "IG-8821",
  "amount": "245000000",
  "currency": "IRR",
  "environment": "live",
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
}`}
      />

      <p>
        Three details matter:
      </p>
      <ul>
        <li>
          <strong>Store <code>reference</code> now.</strong> It is how you read
          the payment later. Without it, you cannot recover the result.
        </li>
        <li>
          <strong><code>checkoutUrl</code> may be null.</strong> Some adapters
          do not use a browser redirect. Do not dereference it blindly.
        </li>
        <li>
          <strong>The amount is returned in whole Iranian Rials (IRR).</strong>{" "}
          OBH returns the integer string (e.g. <code>"245000000"</code>).
        </li>
      </ul>

      <Callout variant="tip" title="The SDK does not expose the HTTP status">
        <p>
          OBH returns <code>201</code> for a new payment and{" "}
          <code>200</code> for an idempotent replay, with an{" "}
          <code>Idempotent-Replayed</code> header. The SDK normalizes both into
          the same <code>Payment</code> value. If you need to distinguish them,
          call the HTTP API directly.
        </p>
      </Callout>

      <h2 id="complete-example">Complete example</h2>
      <CodeBlock
        filename="app/actions/checkout.ts"
        language="ts"
        code={`"use server"

import { redirect } from "next/navigation"

import { obh } from "@/lib/obh"
import { db } from "@/lib/db"

export async function checkout(orderId: string) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
  })

  // A stable key per order attempt. If this key already exists,
  // OBH returns the original payment instead of creating another.
  const idempotencyKey = \`order-\${order.id}-attempt-\${order.attempt}\`

  const payment = await obh.startPayment({
    externalOrderId: order.number,
    amount: order.total,
    currency: "IRR",
    description: order.title,
    returnUrl: "https://igraphical.ir/payments/return",
    metadata: { orderId: order.id, plan: order.plan },
    idempotencyKey,
  })

  await db.order.update({
    where: { id: order.id },
    data: {
      paymentReference: payment.reference,
      paymentStatus: payment.status,
    },
  })

  if (!payment.checkoutUrl) {
    redirect(\`/payments/return?reference=\${payment.reference}\`)
  }

  redirect(payment.checkoutUrl)
}`}
      />

      <h2 id="errors">Errors from creation</h2>
      <p>
        Creation can fail before or during the request. The most common codes
        are listed here; the full table is in{" "}
        <Link href="/errors">Errors</Link>.
      </p>

      <Table
        head={
          <>
            <th>Code</th>
            <th>Typical cause</th>
            <th>Retry?</th>
          </>
        }
      >
        <tr>
          <td>
            <code>INVALID_ARGUMENT</code>
          </td>
          <td>Local validation failed — bad amount, URL, or metadata.</td>
          <td>Only after fixing the input.</td>
        </tr>
        <tr>
          <td>
            <code>VALIDATION_ERROR</code>
          </td>
          <td>The API rejected a field the SDK did not pre-check.</td>
          <td>Only after fixing the input.</td>
        </tr>
        <tr>
          <td>
            <code>ORDER_CONFLICT</code>
          </td>
          <td>
            The external order id exists with different financial details.
          </td>
          <td>No. Reconcile the existing payment.</td>
        </tr>
        <tr>
          <td>
            <code>IDEMPOTENCY_CONFLICT</code>
          </td>
          <td>The same key was used for a different request.</td>
          <td>No. Use a new key for a new request.</td>
        </tr>
        <tr>
          <td>
            <code>RETURN_URL_NOT_ALLOWED</code>
          </td>
          <td>The return URL is not in the exact allowlist.</td>
          <td>No. Register or correct the URL.</td>
        </tr>
        <tr>
          <td>
            <code>PROVIDER_UNAVAILABLE</code>
          </td>
          <td>No active provider account or adapter for the environment.</td>
          <td>Yes, with backoff — and only with the same key.</td>
        </tr>
        <tr>
          <td>
            <code>TIMEOUT</code> / <code>NETWORK_ERROR</code>
          </td>
          <td>The request never produced a definitive answer.</td>
          <td>
            Retrieve first, then retry with the same key if needed.
          </td>
        </tr>
      </Table>

      <Callout variant="warning" title="Timeout does not mean failure">
        <p>
          A timeout means you do not know whether OBH created the payment. It
          may exist and be pending. Call <code>getPayment(reference)</code> if
          you have the reference, or retry the create with the same idempotency
          key — never with a fresh one.
        </p>
      </Callout>
    </DocPage>
  )
}

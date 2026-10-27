import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { PropsTable, Table } from "@/components/table"

export const metadata: Metadata = {
  title: "Errors",
  description:
    "The OBHPaymentsError class, SDK-generated codes, API error codes, and how to recover from each.",
}

const sections = [
  { id: "error-class", title: "One error class" },
  { id: "error-fields", title: "Error fields" },
  { id: "sdk-errors", title: "SDK-generated codes" },
  { id: "api-error-codes", title: "API error codes" },
  { id: "retryable", title: "The retryable flag" },
  { id: "handling-errors", title: "Handling errors well" },
  { id: "request-ids", title: "Request IDs and support" },
  { id: "logging", title: "Logging hygiene" },
]

export default function ErrorsPage() {
  return (
    <DocPage
      href="/errors"
      eyebrow="Reference"
      title="Errors"
      description={
        <>
          Every API failure becomes one typed error. This page explains its
          fields, which codes the SDK generates itself, which come from the API,
          and how to recover without guessing.
        </>
      }
      sections={sections}
    >
      <h2 id="error-class">One error class</h2>
      <p>
        All API and validation failures throw <code>OBHPaymentsError</code>.
        Nothing throws a string, and network failures are not raw{" "}
        <code>TypeError</code>s. The original cause is preserved on{" "}
        <code>error.cause</code> when there is one. The browser guard is the one
        exception: it throws a plain <code>Error</code>, because the SDK is not
        meant to run there at all.
      </p>

      <CodeBlock
        language="ts"
        code={`import { isOBHPaymentsError } from "@obhco/payments"

try {
  await obh.startPayment(input)
} catch (error) {
  if (isOBHPaymentsError(error)) {
    console.error(error.code, error.status, error.requestId)
  } else {
    // A bug in your code, not an API failure.
    throw error
  }
}`}
      />

      <p>
        <code>isOBHPaymentsError()</code> is an <code>instanceof</code> check
        with a type guard. Prefer it over inspecting <code>error.name</code>.
      </p>

      <h2 id="error-fields">Error fields</h2>
      <PropsTable
        rows={[
          {
            name: "code",
            type: "string",
            description:
              "Machine-readable identifier. Either an SDK code or the API error code.",
          },
          {
            name: "status",
            type: "number | undefined",
            description:
              "HTTP status for API errors. Undefined for local validation, network, and timeout errors.",
          },
          {
            name: "requestId",
            type: "string | undefined",
            description:
              "Correlation id from the API envelope or the x-request-id response header.",
          },
          {
            name: "details",
            type: "APIErrorDetail[] | undefined",
            description:
              "Per-field validation messages, each with an optional field and a message.",
          },
          {
            name: "retryable",
            type: "boolean",
            description:
              "True for timeouts, network errors, 429, and 5xx. False otherwise.",
          },
          {
            name: "message",
            type: "string",
            description:
              "A human-readable message. API messages are safe to show to operators, not necessarily to customers.",
          },
          {
            name: "cause",
            type: "unknown | undefined",
            description:
              "The underlying error for transport failures. Never shown to customers.",
          },
        ]}
      />

      <Callout variant="note" title="Details is for fields, not prose">
        <p>
          <code>details</code> is populated from validation envelopes. Render it
          next to the relevant form field when <code>field</code> is present,
          and as a general message otherwise.
        </p>
      </Callout>

      <h2 id="sdk-errors">SDK-generated codes</h2>
      <p>
        These codes never come from the API. They are produced by the SDK before
        or around the call.
      </p>

      <Table
        head={
          <>
            <th>Code</th>
            <th>When</th>
            <th>Retryable</th>
            <th>Fix</th>
          </>
        }
      >
        <tr>
          <td>
            <code>INVALID_ARGUMENT</code>
          </td>
          <td>
            Constructor or input validation failed — bad amount, URL, timeout,
            credential prefix, metadata, or idempotency key.
          </td>
          <td>No</td>
          <td>Correct the input. No request was sent.</td>
        </tr>
        <tr>
          <td>
            <code>NETWORK_ERROR</code>
          </td>
          <td>
            <code>fetch</code> rejected before a response — DNS, TLS, connection
            reset, or offline.
          </td>
          <td>Yes</td>
          <td>Retry with backoff, using the same idempotency key.</td>
        </tr>
        <tr>
          <td>
            <code>TIMEOUT</code>
          </td>
          <td>
            The SDK’s <code>timeoutMs</code> elapsed and the request was
            aborted.
          </td>
          <td>Yes</td>
          <td>Retry or retrieve. The outcome is unknown, not failed.</td>
        </tr>
        <tr>
          <td>
            <code>INVALID_RESPONSE</code>
          </td>
          <td>
            The response was not JSON, or its <code>data</code> did not match
            the payment shape.
          </td>
          <td>No</td>
          <td>
            Likely a proxy or version mismatch. Capture the{" "}
            <code>requestId</code> and contact support.
          </td>
        </tr>
        <tr>
          <td>
            <code>API_ERROR</code>
          </td>
          <td>
            An error response had no <code>error.code</code>. Used as a
            fallback.
          </td>
          <td>Based on status</td>
          <td>
            Inspect <code>status</code> and <code>message</code>.
          </td>
        </tr>
      </Table>

      <h2 id="api-error-codes">API error codes</h2>
      <p>
        These arrive in the API’s error envelope and are surfaced verbatim as{" "}
        <code>code</code>. HTTP status is on <code>error.status</code>.
      </p>

      <Table
        head={
          <>
            <th>HTTP</th>
            <th>Code</th>
            <th>Meaning</th>
          </>
        }
      >
        <tr>
          <td>400</td>
          <td>
            <code>VALIDATION_ERROR</code>
          </td>
          <td>
            Malformed or invalid request body. Check <code>details</code>.
          </td>
        </tr>
        <tr>
          <td>401</td>
          <td>
            <code>AUTH_INVALID</code>
          </td>
          <td>Missing, malformed, revoked, or invalid credential.</td>
        </tr>
        <tr>
          <td>403</td>
          <td>
            <code>SERVICE_INACTIVE</code>
          </td>
          <td>The service is deactivated.</td>
        </tr>
        <tr>
          <td>404</td>
          <td>
            <code>PAYMENT_NOT_FOUND</code>
          </td>
          <td>Not found in this service’s scope.</td>
        </tr>
        <tr>
          <td>409</td>
          <td>
            <code>IDEMPOTENCY_CONFLICT</code>
          </td>
          <td>The same key was used for a different request.</td>
        </tr>
        <tr>
          <td>409</td>
          <td>
            <code>ORDER_CONFLICT</code>
          </td>
          <td>The external order already exists with conflicting details.</td>
        </tr>
        <tr>
          <td>409</td>
          <td>
            <code>PAYMENT_STATE_CONFLICT</code>
          </td>
          <td>Invalid lifecycle operation for the current state.</td>
        </tr>
        <tr>
          <td>413</td>
          <td>
            <code>PAYLOAD_TOO_LARGE</code>
          </td>
          <td>The request body exceeds the size limit.</td>
        </tr>
        <tr>
          <td>415</td>
          <td>
            <code>UNSUPPORTED_MEDIA_TYPE</code>
          </td>
          <td>The body is not JSON.</td>
        </tr>
        <tr>
          <td>422</td>
          <td>
            <code>RETURN_URL_NOT_ALLOWED</code>
          </td>
          <td>The return URL is not an exact allowlist match.</td>
        </tr>
        <tr>
          <td>422</td>
          <td>
            <code>RETURN_URL_REQUIRED</code>
          </td>
          <td>No return URL was supplied and no default is configured.</td>
        </tr>
        <tr>
          <td>422</td>
          <td>
            <code>GATEWAY_NOT_SUPPORTED</code>
          </td>
          <td>
            The <code>gateway</code> code is not one OBH offers. See{" "}
            <Link href="/gateways">Gateways &amp; installments</Link>.
          </td>
        </tr>
        <tr>
          <td>422</td>
          <td>
            <code>CUSTOMER_MOBILE_REQUIRED</code>
          </td>
          <td>
            The chosen gateway (Digipay) needs <code>customerMobile</code>.
          </td>
        </tr>
        <tr>
          <td>503</td>
          <td>
            <code>GATEWAY_NOT_AVAILABLE</code>
          </td>
          <td>
            The gateway has no LIVE credentials yet. Offer another one from{" "}
            <code>listGateways()</code>.
          </td>
        </tr>
        <tr>
          <td>429</td>
          <td>
            <code>RATE_LIMITED</code>
          </td>
          <td>
            Reserved for per-service rate limiting. Not enforced yet, but treat
            it as retryable.
          </td>
        </tr>
        <tr>
          <td>502</td>
          <td>
            <code>PROVIDER_ERROR</code>
          </td>
          <td>Provider transport or response failure, sanitized.</td>
        </tr>
        <tr>
          <td>503</td>
          <td>
            <code>PROVIDER_UNAVAILABLE</code>
          </td>
          <td>No active provider account or adapter.</td>
        </tr>
      </Table>

      <Callout variant="note" title="Provider errors are sanitized">
        <p>
          Raw provider responses, credentials, and request signing details are
          never passed to connected services. Treat <code>PROVIDER_ERROR</code>{" "}
          as an opaque upstream failure and retry.
        </p>
      </Callout>

      <h2 id="retryable">The retryable flag</h2>
      <p>
        For API errors, <code>retryable</code> is true exactly when the HTTP
        status is <code>429</code> or <code>&gt;= 500</code>. Transport failures
        (<code>NETWORK_ERROR</code>, <code>TIMEOUT</code>) are retryable.
        Everything else is not.
      </p>

      <Table
        head={
          <>
            <th>Error</th>
            <th>Safe action</th>
          </>
        }
      >
        <tr>
          <td>
            <code>retryable === true</code> on create
          </td>
          <td>
            Retry with the <em>same</em> idempotency key and backoff.
          </td>
        </tr>
        <tr>
          <td>
            <code>retryable === true</code> on retrieve
          </td>
          <td>Retry freely; reads have no side effects.</td>
        </tr>
        <tr>
          <td>
            <code>retryable === false</code>
          </td>
          <td>
            Do not retry unchanged. Fix the request, credential, or URL first.
          </td>
        </tr>
        <tr>
          <td>
            <code>INVALID_RESPONSE</code>
          </td>
          <td>
            Do not retry blindly; the response contract is broken. Capture the
            request id.
          </td>
        </tr>
      </Table>

      <h2 id="handling-errors">Handling errors well</h2>
      <p>
        A good handler answers three questions: can I retry, what do I tell the
        customer, and what do I record for support?
      </p>

      <CodeBlock
        filename="A production-shaped handler"
        language="ts"
        code={`import { isOBHPaymentsError } from "@obhco/payments"

type CheckoutFailure =
  | { kind: "retry"; message: string }
  | { kind: "user"; message: string; fields?: string[] }
  | { kind: "support"; message: string; requestId?: string }

export function classify(error: unknown): CheckoutFailure {
  if (!isOBHPaymentsError(error)) {
    return { kind: "support", message: "Unexpected error." }
  }

  switch (error.code) {
    case "INVALID_ARGUMENT":
    case "VALIDATION_ERROR":
      return {
        kind: "user",
        message: "Please check the payment details.",
        fields: error.details?.map((detail) => detail.field ?? ""),
      }

    case "AUTH_INVALID":
    case "SERVICE_INACTIVE":
      return {
        kind: "support",
        message: "Payments are temporarily unavailable.",
        requestId: error.requestId,
      }

    case "ORDER_CONFLICT":
    case "IDEMPOTENCY_CONFLICT":
      return {
        kind: "user",
        message: "This order is already being processed.",
      }

    case "RETURN_URL_NOT_ALLOWED":
    case "RETURN_URL_REQUIRED":
      return {
        kind: "support",
        message: "This checkout cannot redirect back to the site.",
        requestId: error.requestId,
      }

    default:
      return {
        kind: error.retryable ? "retry" : "support",
        message: "We could not start the payment.",
        requestId: error.requestId,
      }
  }
}`}
      />

      <h2 id="request-ids">Request IDs and support</h2>
      <p>
        <code>requestId</code> is the fastest way for support to find a failed
        request. Show it in an error reference for the customer, and log it next
        to your own order id and trace id.
      </p>
      <p>
        It can come from the API error envelope or from the{" "}
        <code>x-request-id</code> response header. The SDK prefers the envelope
        value when both exist.
      </p>

      <h2 id="logging">Logging hygiene</h2>
      <Callout variant="danger" title="Never log secrets">
        <p>
          Do not log <code>secretKey</code>, webhook signing secrets,{" "}
          <code>Authorization</code> headers, raw provider credentials, or full
          request bodies that may contain sensitive metadata. Log a request id,
          an error code, an order id, and a duration instead.
        </p>
      </Callout>

      <CodeBlock
        language="ts"
        code={`logger.warn("obh.request.failed", {
  code: error.code,
  status: error.status,
  requestId: error.requestId,
  retryable: error.retryable,
  orderId: order.id,
  // Never: secretKey, authorization, raw body
})`}
      />

      <p>
        Next: the full <Link href="/api-reference">API reference</Link>, or the{" "}
        <Link href="/troubleshooting">troubleshooting table</Link> for specific
        symptoms.
      </p>
    </DocPage>
  )
}

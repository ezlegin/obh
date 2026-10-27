import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { Table } from "@/components/table"

export const metadata: Metadata = {
  title: "Troubleshooting",
  description:
    "Fix the common configuration, authentication, conflict, timeout, and status problems.",
}

const sections = [
  { id: "quick-diagnosis", title: "Quick diagnosis" },
  { id: "common-errors", title: "Common errors" },
  { id: "server-only", title: "Server-only errors" },
  { id: "auth", title: "Authentication" },
  { id: "conflicts", title: "Conflicts" },
  { id: "timeouts", title: "Timeouts and unknown outcomes" },
  { id: "stuck-pending", title: "Payments stuck pending" },
  { id: "tooling", title: "Install and build issues" },
  { id: "faq", title: "FAQ" },
]

export default function TroubleshootingPage() {
  return (
    <DocPage
      href="/troubleshooting"
      eyebrow="Operations"
      title="Troubleshooting"
      description={
        <>
          Start from the error code or the exact message. Most failures are
          configuration errors that the constructor catches, or conflicts that
          require reconciliation rather than another retry.
        </>
      }
      sections={sections}
    >
      <h2 id="quick-diagnosis">Quick diagnosis</h2>
      <Table
        head={
          <>
            <th>What you see</th>
            <th>Most likely cause</th>
            <th>Where to look</th>
          </>
        }
      >
        <tr>
          <td>Throws immediately, before any request</td>
          <td>
            Constructor validation (<code>INVALID_ARGUMENT</code>) or the
            browser guard
          </td>
          <td><Link href="#server-only">Server-only errors</Link></td>
        </tr>
        <tr>
          <td><code>401 AUTH_INVALID</code></td>
          <td>Wrong, malformed, or revoked credential</td>
          <td><Link href="#auth">Authentication</Link></td>
        </tr>
        <tr>
          <td><code>409 ORDER_CONFLICT</code></td>
          <td>Same order id with different details</td>
          <td><Link href="#conflicts">Conflicts</Link></td>
        </tr>
        <tr>
          <td><code>422 RETURN_URL_...</code></td>
          <td>Return URL missing or not exactly allowlisted</td>
          <td><Link href="/payments/create#return-url">Return URLs</Link></td>
        </tr>
        <tr>
          <td><code>TIMEOUT</code> or <code>NETWORK_ERROR</code></td>
          <td>Unknown outcome; do not assume failure</td>
          <td><Link href="#timeouts">Timeouts</Link></td>
        </tr>
        <tr>
          <td>Status stays <code>pending</code></td>
          <td>Provider has not settled, or the payment was abandoned</td>
          <td><Link href="#stuck-pending">Stuck pending</Link></td>
        </tr>
        <tr>
          <td><code>INVALID_RESPONSE</code></td>
          <td>Proxy, wrong base URL, or API version mismatch</td>
          <td><Link href="#tooling">Install and build</Link></td>
        </tr>
      </Table>

      <h2 id="common-errors">Common errors</h2>
      <Table
        head={
          <>
            <th>Message or code</th>
            <th>Fix</th>
          </>
        }
      >
        <tr>
          <td>
            <code>baseUrl must be an absolute URL.</code>
          </td>
          <td>
            Pass a full origin such as <code>https://pay.obh.example</code>, not
            a hostname or a path. Check for an undefined environment variable.
          </td>
        </tr>
        <tr>
          <td>
            <code>baseUrl must use HTTPS except for localhost development.</code>
          </td>
          <td>
            Use <code>https://</code>. Plain HTTP is allowed only for{" "}
            <code>localhost</code>, <code>127.0.0.1</code>, and{" "}
            <code>[::1]</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>baseUrl cannot contain credentials, query, or hash.</code>
          </td>
          <td>
            Remove <code>user:pass@</code>, <code>?params</code>, and{" "}
            <code>#fragment</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>secretKey must be an OBH service credential.</code>
          </td>
          <td>
            The key must begin with <code>svc_</code>. Check that the
            environment variable is loaded in the server process.
          </td>
        </tr>
        <tr>
          <td>
            <code>amount must be a positive decimal string.</code>
          </td>
          <td>
            Use a string like <code>"245000000"</code> or{" "}
            <code>"1000.50"</code>. No numbers, no zero, no negative values, at
            most two decimals.
          </td>
        </tr>
        <tr>
          <td>
            <code>Only IRR is supported.</code>
          </td>
          <td>
            Omit <code>currency</code> or set it to <code>"IRR"</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>metadata cannot exceed 8 KB.</code>
          </td>
          <td>
            Store large documents elsewhere and keep only ids or small flags in
            metadata.
          </td>
        </tr>
        <tr>
          <td>
            <code>The OBH API could not be reached.</code>
          </td>
          <td>
            Check DNS, TLS, firewall, and the base URL. Retry with backoff using
            the same idempotency key.
          </td>
        </tr>
        <tr>
          <td>
            <code>The OBH API returned an unexpected payment shape.</code>
          </td>
          <td>
            The response did not match the payment contract. Confirm the SDK and
            API versions, then report the <code>requestId</code>.
          </td>
        </tr>
      </Table>

      <h2 id="server-only">Server-only errors</h2>
      <p>
        The message is explicit:{" "}
        <code>
          @obhco/payments is server-only and must not run in browser code.
        </code>
      </p>
      <ul>
        <li>
          A file with <code>"use client"</code> imports the module — directly or
          through a shared helper.
        </li>
        <li>A page component is being bundled for the client.</li>
        <li>A test environment defines a global <code>window</code>.</li>
      </ul>
      <p>Move the call into a route handler, server action, or server module.</p>

      <CodeBlock
        filename="lib/obh.ts"
        language="ts"
        code={`import "server-only" // fails the build if imported by a client component

import { OBHPayments } from "@obhco/payments"

export const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: process.env.OBH_API_URL!,
})`}
      />

      <p>
        Do not try to “fix” this with a polyfill or by setting{" "}
        <code>window = undefined</code>. Moving the secret into the browser is
        the actual problem.
      </p>

      <h2 id="auth">Authentication</h2>
      <Table
        head={
          <>
            <th>Code</th>
            <th>Checks</th>
          </>
        }
      >
        <tr>
          <td><code>AUTH_INVALID</code> (401)</td>
          <td>
            Is the header exactly <code>Bearer svc_...</code>? Has the
            credential been revoked? Is there a stray whitespace or newline in
            the environment variable?
          </td>
        </tr>
        <tr>
          <td><code>SERVICE_INACTIVE</code> (403)</td>
          <td>The service is deactivated. Contact an OBH administrator.</td>
        </tr>
        <tr>
          <td><code>PAYMENT_NOT_FOUND</code> (404)</td>
          <td>
            Wrong reference, wrong service, or wrong environment. Another
            service’s payment deliberately looks identical to a missing one.
          </td>
        </tr>
      </Table>

      <Callout variant="warning" title="A trailing newline is a real bug">
        <p>
          Secrets pasted from a terminal or a dashboard often carry a trailing
          newline. The credential then fails authentication with a valid-looking
          key. Trim environment values, or let your config loader do it.
        </p>
      </Callout>

      <h2 id="conflicts">Conflicts</h2>
      <h3>ORDER_CONFLICT</h3>
      <p>
        The external order id already exists but the new request has different
        financial details. Retrieve the existing payment by reference and
        reconcile. If the customer genuinely needs a new payment, use a new
        order id (or a new attempt that the API treats as a new order).
      </p>

      <h3>IDEMPOTENCY_CONFLICT</h3>
      <p>
        A key was reused for a different request. Do not generate a new key and
        fire the request again — that can create a second payment. Inspect the
        key derivation and the request fingerprint.
      </p>

      <CodeBlock
        language="ts"
        code={`// Wrong: the second attempt silently creates a new key.
obh.startPayment({ ...input, idempotencyKey: crypto.randomUUID() })

// Right: one key per logical attempt, reused across retries.
obh.startPayment({ ...input, idempotencyKey: \`order-\${id}-attempt-\${n}\` })`}
      />

      <h2 id="timeouts">Timeouts and unknown outcomes</h2>
      <p>
        <code>TIMEOUT</code> and <code>NETWORK_ERROR</code> mean the SDK did not
        receive a definitive answer. They do not mean the payment failed.
      </p>
      <ol>
        <li>If you already stored a reference, call <code>getPayment()</code>.</li>
        <li>
          If you have no reference, retry <code>startPayment()</code> with the
          same idempotency key.
        </li>
        <li>Do not tell the customer the payment failed based on a timeout.</li>
        <li>Do not switch to a new key “to be safe”.</li>
      </ol>

      <h2 id="stuck-pending">Payments stuck pending</h2>
      <p>
        A pending payment is normal for seconds, sometimes longer. It resolves
        through server-side verification; there is no admin endpoint in this SDK
        to force it.
      </p>
      <ul>
        <li>Confirm the customer actually completed checkout.</li>
        <li>Check the payment’s <code>verifiedAt</code> and <code>status</code>.</li>
        <li>Stop polling after a bounded number of attempts.</li>
        <li>
          For a test environment, ensure the development adapter is enabled and
          that you completed the local checkout simulation.
        </li>
        <li>
          If it stays pending long after checkout, record the reference and
          request id and escalate. Do not fabricate a completion.
        </li>
      </ul>

      <h2 id="tooling">Install and build issues</h2>
      <Table
        head={
          <>
            <th>Symptom</th>
            <th>Cause and fix</th>
          </>
        }
      >
        <tr>
          <td><code>Cannot find module '@obhco/payments'</code></td>
          <td>
            The workspace dependency is missing. Add{" "}
            <code>"@obhco/payments": "workspace:*"</code> and reinstall. The
            package is not on npm.
          </td>
        </tr>
        <tr>
          <td>“Unexpected token export” in a CommonJS runtime</td>
          <td>
            The package is ESM-only. Use <code>import</code> or dynamic{" "}
            <code>import()</code>.
          </td>
        </tr>
        <tr>
          <td>Types resolve to <code>dist</code> but the folder is empty</td>
          <td>
            Run <code>pnpm --filter @obhco/payments build</code> first.
          </td>
        </tr>
        <tr>
          <td>Edge runtime runtime errors</td>
          <td>
            Use the Node.js runtime. Edge is not officially tested for this SDK.
          </td>
        </tr>
        <tr>
          <td><code>INVALID_RESPONSE</code> behind a proxy</td>
          <td>
            A proxy may be returning an HTML error page. Check the status and
            body, and allowlist the OBH origin.
          </td>
        </tr>
      </Table>

      <h2 id="faq">FAQ</h2>
      <h3>Is the SDK production-ready?</h3>
      <p>
        No. It is published on npm as `@obhco/payments@0.1.0` and tested locally
        only. It has never processed a real payment.
      </p>

      <h3>Can I use it in a browser or React client component?</h3>
      <p>
        No. There is no browser entrypoint; the constructor throws. There is
        also no reason to — the secret is server-side by design.
      </p>

      <h3>Can I get a LIVE credential?</h3>
      <p>
        Not yet. Only TEST credentials are issued until a live provider adapter
        is approved and tested.
      </p>

      <h3>Does the SDK support refunds, cancellation, or captures?</h3>
      <p>
        No. The API exposes only create and retrieve. Do not design a refund
        flow around this version.
      </p>

      <h3>How do I charge for multiple items?</h3>
      <p>
        Send one amount that is the order total, put a human-readable summary in{" "}
        <code>description</code>, and keep the line items in your own database
        (optionally an order id in <code>metadata</code>).
      </p>

      <h3>Does the SDK retry automatically?</h3>
      <p>
        No. It makes exactly one request per call. Retries are your decision, so
        that you control idempotency, backoff, and user experience.
      </p>

      <h3>Can I call the HTTP API without the SDK?</h3>
      <p>
        Yes. The SDK adds validation, typing, timeouts, and error mapping. If
        you implement those yourself, the{" "}
        <Link href="/api-reference#http-api">HTTP reference</Link> is complete.
      </p>

      <h3>Why is <code>checkoutUrl</code> null?</h3>
      <p>
        Some adapters complete the payment without a redirect. Check the status
        and design your UI to handle a missing URL instead of asserting it.
      </p>

      <h3>Which Node.js version do I need?</h3>
      <p>
        Node.js 20 or newer, as declared by the package’s{" "}
        <code>engines</code> field.
      </p>
    </DocPage>
  )
}

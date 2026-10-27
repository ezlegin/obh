import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/docs/callout"
import { CodeBlock } from "@/components/docs/code-block"
import { DocPage } from "@/components/docs/doc-page"
import { Endpoint } from "@/components/docs/content"
import { StatusPill } from "@/components/docs/status-pill"
import { Table } from "@/components/docs/table"

export const metadata: Metadata = {
  title: "Check status",
  description:
    "Retrieve a payment by reference, poll pending payments with backoff, and reconcile with webhooks.",
}

const sections = [
  { id: "retrieve-one-payment", title: "Retrieve one payment" },
  { id: "what-counts-as-done", title: "What counts as done" },
  { id: "polling", title: "Polling with backoff" },
  { id: "webhook-first", title: "Webhook-first reconciliation" },
  { id: "references", title: "References and isolation" },
  { id: "failure-modes", title: "Failure modes" },
]

export default function RetrievePaymentPage() {
  return (
    <DocPage
      href="/docs/payments/retrieve"
      eyebrow="Building"
      title="Check status"
      description={
        <>
          <code>getPayment()</code> reads the current state of one payment from
          OBH. It is the only value you should use to decide whether an order
          was paid.
        </>
      }
      sections={sections}
    >
      <h2 id="retrieve-one-payment">Retrieve one payment</h2>
      <CodeBlock
        language="ts"
        code={`class OBHPayments {
  getPayment(reference: string): Promise<Payment>
}`}
      />

      <Endpoint method="GET" path="/api/v1/payments/{reference}" />

      <CodeBlock
        filename="TypeScript"
        language="ts"
        code={`const payment = await obh.getPayment("OBH-8B30F9C07A52D1E4")

console.log(payment.status)       // "pending" | "completed" | ...
console.log(payment.completedAt)  // string | null
console.log(payment.verifiedAt)   // string | null`}
      />

      <p>
        The method accepts a reference of 1–64 characters, URL-encodes it, and
        returns the same <code>Payment</code> shape as{" "}
        <code>startPayment()</code>. Retrieval has no side effects.
      </p>

      <h2 id="what-counts-as-done">What counts as done</h2>
      <Table
        head={
          <>
            <th>Status</th>
            <th>What your application should do</th>
          </>
        }
      >
        <tr>
          <td>
            <StatusPill status="completed" />
          </td>
          <td>
            Fulfil the order exactly once. Persist the fact that you fulfilled
            it, keyed by payment reference.
          </td>
        </tr>
        <tr>
          <td>
            <StatusPill status="pending" />
          </td>
          <td>
            Do not fulfil. Show a waiting state, keep polling with backoff, or
            wait for the webhook.
          </td>
        </tr>
        <tr>
          <td>
            <StatusPill status="failed" />
          </td>
          <td>
            Do not fulfil. Offer a retry that creates a new order attempt with a
            new idempotency key.
          </td>
        </tr>
        <tr>
          <td>
            <StatusPill status="cancelled" />
          </td>
          <td>Do not fulfil. Let the customer start a new checkout.</td>
        </tr>
        <tr>
          <td>
            <StatusPill status="expired" />
          </td>
          <td>
            Do not fulfil. The checkout window closed; a new payment is
            required.
          </td>
        </tr>
      </Table>

      <Callout variant="danger" title="Fulfil at most once">
        <p>
          A return page can be refreshed, a webhook retried, and a poller run
          twice. Make fulfilment idempotent on your side too — for example, a
          unique constraint on the payment reference, or an update that only
          transitions an order from <code>unpaid</code> to <code>paid</code>.
        </p>
      </Callout>

      <h2 id="polling">Polling with backoff</h2>
      <p>
        A payment is often <code>pending</code> for a few seconds after the
        customer returns. Poll with exponential backoff and a hard attempt
        limit; do not loop tightly or forever.
      </p>

      <CodeBlock
        filename="lib/wait-for-payment.ts"
        language="ts"
        code={`import { obh } from "@/lib/obh"
import type { Payment } from "@obhco/payments"

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function waitForPayment(
  reference: string,
  { attempts = 7, baseDelayMs = 800 } = {}
): Promise<Payment> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const payment = await obh.getPayment(reference)

    if (payment.status !== "pending") {
      return payment
    }

    const exponential = baseDelayMs * 2 ** attempt
    const capped = Math.min(exponential, 8_000)
    const jitter = Math.random() * 250

    await sleep(capped + jitter)
  }

  // Still pending: return the latest known state, do not invent one.
  return obh.getPayment(reference)
}`}
      />

      <p>
        Backoff protects both services: it avoids rate-limit pressure and it
        gives the provider time to settle. Jitter prevents many customers
        returning at the same moment from producing a synchronized burst.
      </p>

      <Callout variant="warning" title="Serverless time limits">
        <p>
          A request that waits 60 seconds may exceed your platform’s execution
          limit. Prefer a webhook to trigger reconciliation, or move long waits
          into a background worker. A pending return page can also refresh
          itself and poll a lightweight endpoint.
        </p>
      </Callout>

      <h2 id="webhook-first">Webhook-first reconciliation</h2>
      <p>The recommended production pattern is:</p>
      <ol>
        <li>Create the payment and store its reference.</li>
        <li>Redirect the customer to checkout.</li>
        <li>
          Receive a <code>payment.completed</code> or{" "}
          <code>payment.failed</code> webhook on your server.
        </li>
        <li>Verify the signature, deduplicate the event id, then retrieve.</li>
        <li>
          Fulfil only if the retrieved status is <code>completed</code>.
        </li>
        <li>
          Use the return page as a UX shortcut that does the same retrieval —
          never as the only path.
        </li>
      </ol>
      <p>
        Webhooks are covered in detail in{" "}
        <Link href="/docs/webhooks">Webhooks</Link>.
      </p>

      <CodeBlock
        filename="Reconcile after a webhook"
        language="ts"
        code={`async function reconcile(reference: string) {
  const payment = await obh.getPayment(reference)

  if (payment.status === "completed") {
    await markOrderPaidOnce(payment.externalOrderId!)
  } else if (payment.status !== "pending") {
    await markOrderFailedOnce(payment.reference, payment.status)
  }
}`}
      />

      <h2 id="references">References and isolation</h2>
      <p>
        A reference looks like <code>OBH-8B30F9C07A52D1E4</code>. It identifies
        a payment within OBH and is safe to store and to show to the customer as
        an order code.
      </p>
      <ul>
        <li>
          A service can only read its own payments. Another service’s reference
          returns <code>404 PAYMENT_NOT_FOUND</code>, exactly like a reference
          that does not exist. This prevents enumerating other services’
          payments.
        </li>
        <li>
          The reference is not a secret, but it is also not an authorization
          token. Anyone with it can only read the payment through an
          authenticated service call.
        </li>
        <li>
          Do not confuse <code>reference</code> with your own{" "}
          <code>externalOrderId</code>. OBH creates the reference; you create
          the order id.
        </li>
      </ul>

      <h2 id="failure-modes">Failure modes</h2>
      <Table
        head={
          <>
            <th>Situation</th>
            <th>What happens</th>
            <th>What to do</th>
          </>
        }
      >
        <tr>
          <td>Payment not found</td>
          <td>
            <code>404 PAYMENT_NOT_FOUND</code>
          </td>
          <td>
            Check the reference and that you are using the owning service’s key.
          </td>
        </tr>
        <tr>
          <td>Credential revoked</td>
          <td>
            <code>401 AUTH_INVALID</code>
          </td>
          <td>Issue a new credential; retrying will not help.</td>
        </tr>
        <tr>
          <td>API unreachable</td>
          <td>
            <code>NETWORK_ERROR</code>
          </td>
          <td>Retry the read with backoff. Reads are always safe to retry.</td>
        </tr>
        <tr>
          <td>Took too long</td>
          <td>
            <code>TIMEOUT</code>
          </td>
          <td>Retry the read; the payment state is unaffected.</td>
        </tr>
        <tr>
          <td>Malformed response</td>
          <td>
            <code>INVALID_RESPONSE</code>
          </td>
          <td>
            Treat as an integration bug. Record the <code>requestId</code> and
            contact support.
          </td>
        </tr>
      </Table>

      <p>
        Next, learn how to make creation retries safe:{" "}
        <Link href="/docs/idempotency">Idempotency &amp; retries</Link>.
      </p>
    </DocPage>
  )
}

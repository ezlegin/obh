import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/docs/callout"
import { CodeBlock } from "@/components/docs/code-block"
import { DocPage } from "@/components/docs/doc-page"
import { Table } from "@/components/docs/table"

export const metadata: Metadata = {
  title: "Idempotency & retries",
  description:
    "How OBH idempotency keys prevent double charges, how to choose one, and which failures are safe to retry.",
}

const sections = [
  { id: "the-problem", title: "The problem" },
  { id: "how-it-works", title: "How idempotency keys work" },
  { id: "choosing-a-key", title: "Choosing a key" },
  { id: "retry-matrix", title: "What is safe to retry" },
  { id: "retry-loop", title: "A retry loop" },
  { id: "conflicts", title: "Conflicts" },
  { id: "pitfalls", title: "Pitfalls" },
]

export default function IdempotencyPage() {
  return (
    <DocPage
      href="/docs/idempotency"
      eyebrow="Building"
      title="Idempotency & retries"
      description={
        <>
          Networks fail in the most inconvenient place: after a request left
          your server but before the response arrived. Idempotency keys turn
          that ambiguity into a safe retry.
        </>
      }
      sections={sections}
    >
      <h2 id="the-problem">The problem</h2>
      <p>
        You call <code>startPayment()</code>. The connection drops. Did OBH
        create a payment? You cannot tell. If you retry naively, you might
        create two payments for one order. If you give up, the customer may have
        a valid checkout you never learned about.
      </p>
      <p>
        An idempotency key resolves this. It tells OBH: “this is the same
        attempt as before; give me its result instead of creating another
        payment.”
      </p>

      <h2 id="how-it-works">How idempotency keys work</h2>
      <p>
        Every create request carries an <code>Idempotency-Key</code> header,
        scoped to the authenticated service.
      </p>
      <ul>
        <li>
          <strong>Same key, same request</strong> — OBH returns the original
          payment. Replay is marked with <code>Idempotent-Replayed: true</code>{" "}
          on the HTTP response.
        </li>
        <li>
          <strong>Same key, different request</strong> — OBH returns{" "}
          <code>409 IDEMPOTENCY_CONFLICT</code>. A consumed key can never be
          reused for a different financial request.
        </li>
        <li>
          <strong>Different key, same order</strong> — OBH compares the external
          order id. If the details match, it returns the existing payment;
          otherwise <code>409 ORDER_CONFLICT</code>.
        </li>
      </ul>

      <CodeBlock
        filename="HTTP view"
        language="http"
        code={`POST /api/v1/payments HTTP/1.1
Authorization: Bearer svc_test_<key-id>.<secret>
Idempotency-Key: order-IG-8821-attempt-1
Content-Type: application/json

{"externalOrderId":"IG-8821","amount":"245000000","description":"Annual design workspace","currency":"IRR"}`}
      />

      <p>
        The ledger is durable. A key that was accepted — even one that replayed
        an existing order — stays consumed. That is the point: a retry must land
        on the original payment, not create a second one.
      </p>

      <h2 id="choosing-a-key">Choosing a key</h2>
      <p>
        The SDK uses your key verbatim when supplied. When omitted, it generates{" "}
        <code>sdk_&lt;uuid&gt;</code>, which is fine for a single attempt but
        cannot be reproduced by a retry.
      </p>

      <Table
        head={
          <>
            <th>Pattern</th>
            <th>When to use it</th>
          </>
        }
      >
        <tr>
          <td>
            <code>order-&#123;id&#125;-attempt-&#123;n&#125;</code>
          </td>
          <td>
            Recommended. Matches one checkout attempt. A genuine new attempt
            (after a failed or expired payment) gets a new <code>n</code>.
          </td>
        </tr>
        <tr>
          <td>
            <code>&#123;idempotencyKey from client&#125;</code>
          </td>
          <td>
            Use when the browser already has a per-checkout UUID. Validate and
            scope it to the authenticated user on your side.
          </td>
        </tr>
        <tr>
          <td>
            <code>order-&#123;id&#125;</code>
          </td>
          <td>
            Acceptable only if an order can never legitimately be paid twice. It
            prevents ever retrying checkout for that order.
          </td>
        </tr>
        <tr>
          <td>
            <code>random UUID per request</code>
          </td>
          <td>
            Avoid. It looks safe but provides no protection, because each retry
            gets a new key.
          </td>
        </tr>
      </Table>

      <p>
        Keys are 1–191 visible ASCII characters. Store the key with the order
        attempt <em>before</em> sending the request, so a crash after sending
        still leaves you able to retry with the same key.
      </p>

      <CodeBlock
        filename="Persist the key first"
        language="ts"
        code={`const attempt = await db.paymentAttempt.create({
  data: {
    orderId: order.id,
    idempotencyKey: \`order-\${order.id}-attempt-\${order.attempt}\`,
    status: "started",
  },
})

const payment = await obh.startPayment({
  externalOrderId: order.number,
  amount: order.total,
  description: order.title,
  idempotencyKey: attempt.idempotencyKey,
})`}
      />

      <h2 id="retry-matrix">What is safe to retry</h2>
      <Table
        head={
          <>
            <th>Outcome</th>
            <th>
              <code>retryable</code>
            </th>
            <th>Action</th>
          </>
        }
      >
        <tr>
          <td>
            <code>TIMEOUT</code>
          </td>
          <td>true</td>
          <td>
            The result is unknown. Retry the create with the <em>same</em> key,
            or retrieve by reference if you have it.
          </td>
        </tr>
        <tr>
          <td>
            <code>NETWORK_ERROR</code>
          </td>
          <td>true</td>
          <td>Same as timeout: retry with the same key.</td>
        </tr>
        <tr>
          <td>
            <code>429 RATE_LIMITED</code>
          </td>
          <td>true</td>
          <td>Back off, then retry with the same key.</td>
        </tr>
        <tr>
          <td>
            <code>5xx</code> (for example <code>PROVIDER_ERROR</code>)
          </td>
          <td>true</td>
          <td>
            Back off and retry with the same key. Provider failures are
            sanitized, not necessarily permanent.
          </td>
        </tr>
        <tr>
          <td>
            <code>4xx</code> validation or auth
          </td>
          <td>false</td>
          <td>
            Fix the request or the credential. Retrying unchanged will fail
            again.
          </td>
        </tr>
        <tr>
          <td>
            <code>ORDER_CONFLICT</code> / <code>IDEMPOTENCY_CONFLICT</code>
          </td>
          <td>false</td>
          <td>
            Do not retry. Reconcile the existing payment or investigate the key.
          </td>
        </tr>
      </Table>

      <Callout variant="note" title="Reads are always retryable">
        <p>
          <code>getPayment()</code> has no side effects. Network errors and
          timeouts on reads can be retried with backoff regardless of the key
          rules.
        </p>
      </Callout>

      <h2 id="retry-loop">A retry loop</h2>
      <p>
        Keep retries short and bounded. Honour <code>retryable</code> rather
        than pattern-matching on every code, and always reuse the key.
      </p>

      <CodeBlock
        filename="lib/start-payment.ts"
        language="ts"
        code={`import { isOBHPaymentsError } from "@obhco/payments"

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function startPaymentSafely(
  input: StartPaymentInput,
  idempotencyKey: string
) {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await obh.startPayment({ ...input, idempotencyKey })
    } catch (error) {
      lastError = error

      if (!isOBHPaymentsError(error) || !error.retryable) {
        throw error
      }

      // 250ms, 500ms, 1000ms with jitter
      await sleep(250 * 2 ** attempt + Math.random() * 100)
    }
  }

  throw lastError
}`}
      />

      <p>
        Do not add a retry loop to <code>startPayment</code> that generates a
        key internally. The key must be the same across attempts; that is the
        entire mechanism.
      </p>

      <h2 id="conflicts">Conflicts</h2>
      <h3>IDEMPOTENCY_CONFLICT</h3>
      <p>
        You reused a key for a request whose financial details differ — amount,
        currency, order, or another fingerprinted field. Treat it as a bug:
        either the key derivation is too coarse (for example, reusing an
        order-level key for a second attempt) or the request changed when it
        should not have.
      </p>

      <CodeBlock
        language="ts"
        code={`if (error.code === "IDEMPOTENCY_CONFLICT") {
  // The key belongs to a different request. Do not "fix" it by
  // generating a new key mid-flight — that can double-charge.
  logger.error("idempotency key reused", {
    requestId: error.requestId,
    orderId: order.id,
  })
  throw new CheckoutError("This checkout attempt is already in use.")
}`}
      />

      <h3>ORDER_CONFLICT</h3>
      <p>
        The external order id already exists with different details. This
        usually means two checkout attempts for the same order used different
        amounts, or the order was edited after the first payment was created.
        Retrieve the existing payment and reconcile; do not create a parallel
        one.
      </p>

      <h2 id="pitfalls">Pitfalls</h2>
      <ul>
        <li>
          <strong>Generating the key too late.</strong> If the key is created
          inside the request function, a retry cannot reuse it. Create it before
          the first send and persist it.
        </li>
        <li>
          <strong>Reusing an order-level key forever.</strong> A failed or
          expired attempt needs a new key if the customer genuinely starts
          again. Include an attempt counter.
        </li>
        <li>
          <strong>Treating a timeout as a failure.</strong> A timeout is an
          unknown outcome, not a declined payment. Never tell the customer it
          failed until you have read a terminal status.
        </li>
        <li>
          <strong>Changing the request on retry.</strong> Changing the amount or
          metadata and keeping the key turns a retry into a conflict. Keep the
          request byte-for-byte stable for one key.
        </li>
      </ul>

      <p>
        Continue with <Link href="/docs/errors">Errors</Link> to see how every
        failure is represented.
      </p>
    </DocPage>
  )
}

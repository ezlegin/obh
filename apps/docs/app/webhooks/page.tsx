import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { Table } from "@/components/table"

export const metadata: Metadata = {
  title: "Webhooks",
  description:
    "Verify OBH webhook signatures, deduplicate events, and reconcile payments safely.",
}

const sections = [
  { id: "what-you-receive", title: "What you receive" },
  { id: "signature-headers", title: "Signature headers" },
  { id: "verify-a-signature", title: "Verify a signature" },
  { id: "deduplicate", title: "Deduplicate events" },
  { id: "retries", title: "Delivery and retries" },
  { id: "reacting", title: "Reacting correctly" },
  { id: "operating", title: "Operating the endpoint" },
]

export default function WebhooksPage() {
  return (
    <DocPage
      href="/webhooks"
      eyebrow="Building"
      title="Webhooks"
      description={
        <>
          OBH can notify your server when a payment reaches a terminal state.
          The SDK does not verify these requests — you do, with your webhook
          signing secret. This page shows the exact algorithm.
        </>
      }
      sections={sections}
    >
      <Callout variant="warning" title="The SDK does not handle webhooks">
        <p>
          There is no webhook helper in <code>@obhco/payments</code>. Signatures
          must be verified by your server with the per-service webhook secret.
          The secret is separate from your API credential and is shown when
          created or rotated in OBH Admin.
        </p>
      </Callout>

      <h2 id="what-you-receive">What you receive</h2>
      <p>
        Webhooks are sent to the service’s configured webhook URL as{" "}
        <code>POST</code> requests with a JSON body. Two event types exist
        today:
      </p>

      <Table
        head={
          <>
            <th>Event</th>
            <th>When</th>
          </>
        }
      >
        <tr>
          <td>
            <code>payment.completed</code>
          </td>
          <td>A payment was verified as completed.</td>
        </tr>
        <tr>
          <td>
            <code>payment.failed</code>
          </td>
          <td>A payment reached a failed terminal state.</td>
        </tr>
      </Table>

      <p>
        Each delivery has a stable <code>evt_...</code> identifier and includes
        the OBH payment object.
      </p>

      <CodeBlock
        filename="Example payload"
        language="json"
        code={`{
  "id": "evt_01J9Z6K3T4QW8M2",
  "type": "payment.completed",
  "createdAt": "2026-10-18T08:04:12.000Z",
  "data": {
    "id": "018f0000-0000-7000-8000-000000000001",
    "reference": "OBH-8B30F9C07A52D1E4",
    "externalOrderId": "IG-8821",
    "amount": "245000000.00",
    "currency": "IRR",
    "environment": "test",
    "status": "completed",
    "completedAt": "2026-10-18T08:04:10.000Z",
    "verifiedAt": "2026-10-18T08:04:10.000Z"
  }
}`}
      />

      <Callout variant="note" title="Cancellation and expiry events">
        <p>
          They are reserved for a later lifecycle implementation. Today, a
          cancelled or expired payment is discovered by retrieving it, not by a
          webhook.
        </p>
      </Callout>

      <h2 id="signature-headers">Signature headers</h2>
      <CodeBlock
        language="http"
        code={`OBH-Event-Id: evt_01J9Z6K3T4QW8M2
OBH-Timestamp: 1760000000
OBH-Signature: t=1760000000,v1=<hex hmac>`}
      />

      <p>
        The signature is an HMAC-SHA256 over{" "}
        <code>&lt;timestamp&gt;.&lt;raw request body&gt;</code>, keyed with
        your webhook signing secret and encoded as lowercase hex. The same
        timestamp appears both in <code>OBH-Timestamp</code> and in the{" "}
        <code>t=</code> component of <code>OBH-Signature</code>.
      </p>

      <ul>
        <li>The API credential is not the webhook secret.</li>
        <li>
          Signatures cover the exact bytes sent. Re-serialized JSON will not
          match.
        </li>
        <li>
          The signing secret is encrypted at rest with a key derived from{" "}
          <code>AUTH_SECRET</code>. Rotating <code>AUTH_SECRET</code> without
          rotating service webhook secrets makes existing secrets unreadable.
        </li>
      </ul>

      <h2 id="verify-a-signature">Verify a signature</h2>
      <p>
        Read the raw body before parsing it. Then compare the computed digest
        with the <code>v1</code> value using a timing-safe comparison, and
        reject timestamps outside a small tolerance window.
      </p>

      <CodeBlock
        filename="app/api/webhooks/obh/route.ts"
        language="ts"
        code={`import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import { obh } from "@/lib/obh"

const TOLERANCE_SECONDS = 300

export async function POST(request: Request) {
  // 1. Read the exact bytes that were signed.
  const rawBody = await request.text()

  const eventId = request.headers.get("obh-event-id")
  const timestamp = request.headers.get("obh-timestamp")
  const signature = request.headers.get("obh-signature")

  if (!eventId || !timestamp || !signature) {
    return new NextResponse("Missing signature headers", { status: 400 })
  }

  // 2. Reject stale deliveries (replay protection).
  const timestampSeconds = Number(timestamp)
  const age = Math.abs(Date.now() / 1000 - timestampSeconds)

  if (!Number.isFinite(timestampSeconds) || age > TOLERANCE_SECONDS) {
    return new NextResponse("Stale timestamp", { status: 400 })
  }

  // 3. Parse t=... and v1=... from the signature header.
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=")
      return [key, value]
    })
  )

  const signatureTimestamp = parts.t
  const provided = parts.v1

  if (!signatureTimestamp || !provided || signatureTimestamp !== timestamp) {
    return new NextResponse("Malformed signature", { status: 400 })
  }

  // 4. HMAC-SHA256 over \`<timestamp>.<raw body>\`.
  const expected = createHmac("sha256", process.env.OBH_WEBHOOK_SECRET!)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest("hex")

  const expectedBuffer = Buffer.from(expected, "utf8")
  const providedBuffer = Buffer.from(provided, "utf8")

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return new NextResponse("Invalid signature", { status: 401 })
  }

  // 5. Verify first, parse second.
  const event = JSON.parse(rawBody) as {
    id: string
    type: "payment.completed" | "payment.failed"
    data: { reference: string }
  }

  if (!(await claimEventOnce(event.id))) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (event.type === "payment.completed") {
    const payment = await obh.getPayment(event.data.reference)

    if (payment.status === "completed") {
      await markOrderPaidOnce(payment.externalOrderId!)
    }
  }

  return NextResponse.json({ received: true })
}`}
      />

      <Callout variant="danger" title="Do not verify a parsed-and-reserialized body">
        <p>
          If your framework parses JSON and you stringify it again, whitespace
          and key order may change and the HMAC will not match. Capture the raw
          bytes first — <code>request.text()</code> in a Web{" "}
          <code>Request</code>, a raw-body parser in Express, or the raw body
          option in other frameworks.
        </p>
      </Callout>

      <h2 id="deduplicate">Deduplicate events</h2>
      <p>
        Delivery is at-least-once. The same event id can arrive more than once,
        so record it and refuse to process it twice.
      </p>

      <CodeBlock
        filename="Idempotent processing"
        language="ts"
        code={`async function claimEventOnce(eventId: string) {
  try {
    await db.webhookEvent.create({ data: { id: eventId } })
    return true
  } catch (error) {
    // Unique constraint: already processed.
    return false
  }
}`}
      />

      <p>
        Combine that with idempotent fulfilment (<code>markOrderPaidOnce</code>)
        so a duplicate delivery cannot ship two orders even if the event ledger
        is lost.
      </p>

      <h2 id="retries">Delivery and retries</h2>
      <ul>
        <li>
          A <code>2xx</code> response acknowledges delivery. Anything else, or
          a timeout, is retried with backoff.
        </li>
        <li>
          Each delivery has a 5-second timeout and up to 6 attempts. The retry
          delays are 1 minute, 5 minutes, 30 minutes, 2 hours, and 6 hours.
        </li>
        <li>
          The first attempt is made immediately after the terminal payment
          update.
        </li>
        <li>
          A scheduled worker retries due deliveries. In this repository it runs
          with <code>pnpm --filter web webhooks:process</code> and is not yet
          scheduled automatically.
        </li>
        <li>
          Each delivery row stores attempts, the next attempt time, and a
          sanitized error.
        </li>
      </ul>

      <Callout variant="warning" title="Production requires a scheduler">
        <p>
          If the retry worker never runs, failed deliveries are never retried.
          A production deployment must schedule the worker (a cron job, a
          platform scheduler, or a queue) and monitor it.
        </p>
      </Callout>

      <h2 id="reacting">Reacting correctly</h2>
      <p>
        Acknowledge quickly, then do durable work. The provider’s HTTP client
        waits for your response; expensive work should happen in a background
        job where possible.
      </p>
      <ol>
        <li>Verify the signature and timestamp.</li>
        <li>Deduplicate by event id.</li>
        <li>Retrieve the payment for its authoritative state.</li>
        <li>Perform idempotent fulfilment or failure handling.</li>
        <li>Return <code>2xx</code>.</li>
      </ol>
      <p>
        Never fulfil based solely on the webhook body. It is a notification,
        not the state — and an old event can arrive after a newer one.
      </p>

      <h2 id="operating">Operating the endpoint</h2>
      <ul>
        <li>Configure both a webhook URL and a signing secret in OBH Admin.</li>
        <li>
          Store <code>OBH_WEBHOOK_SECRET</code> in server-side configuration.
          It is not the same value as <code>OBH_SERVICE_KEY</code>.
        </li>
        <li>
          Rotate the secret in OBH Admin if it leaks. There is no recovery for
          a lost secret.
        </li>
        <li>
          Log event ids and request ids, never the secret or the raw signature
          of a valid request.
        </li>
        <li>
          Alert on repeated signature failures; they may indicate a
          misconfiguration or an attack.
        </li>
      </ul>

      <p>
        See also <Link href="/security">Security</Link> and{" "}
        <Link href="/guides/nextjs">Next.js integration</Link> for a complete
        working route.
      </p>
    </DocPage>
  )
}

import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { Step, Steps } from "@/components/steps"

export const metadata: Metadata = {
  title: "Next.js integration",
  description:
    "A complete App Router integration: server-only client, checkout handler, return page, and webhook.",
}

const sections = [
  { id: "shape", title: "The shape of the integration" },
  { id: "client", title: "1. A server-only client" },
  { id: "checkout", title: "2. Start checkout" },
  { id: "return-page", title: "3. The return page" },
  { id: "fulfilment", title: "4. Idempotent fulfilment" },
  { id: "webhook", title: "5. The webhook route" },
  { id: "pitfalls", title: "Next.js pitfalls" },
  { id: "deploy", title: "Deployment checklist" },
]

export default function NextGuidePage() {
  return (
    <DocPage
      href="/guides/nextjs"
      eyebrow="Guide"
      title="Next.js integration"
      description={
        <>
          A working App Router flow for this repository’s stack: route handlers
          for mutations, a server component for the return page, and a signed
          webhook route. No client component ever imports the SDK.
        </>
      }
      sections={sections}
    >
      <h2 id="shape">The shape of the integration</h2>
      <p>
        Next.js blurs the server/client boundary, so be explicit. Put the SDK in
        a module marked <code>server-only</code>, and reach it from:
      </p>
      <ul>
        <li>a route handler (<code>app/api/.../route.ts</code>) for checkout,</li>
        <li>a server component page for the return screen,</li>
        <li>a server action for form-driven checkout,</li>
        <li>a route handler for webhooks.</li>
      </ul>
      <p>
        Client components should only receive the resulting{" "}
        <code>checkoutUrl</code> or a rendered status — never the client
        instance or the key.
      </p>

      <h2 id="client">1. A server-only client</h2>
      <CodeBlock
        filename="lib/obh.ts"
        language="ts"
        code={`import "server-only"

import { OBHPayments } from "@obh/payments"

if (!process.env.OBH_SERVICE_KEY) {
  throw new Error("OBH_SERVICE_KEY is not configured.")
}

export const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY,
  timeoutMs: 15_000,
})`}
      />

      <p>
        <code>import "server-only"</code> makes the build fail if a client
        component ever imports this file. It is a stronger and earlier guard
        than the SDK’s runtime check.
      </p>

      <h2 id="checkout">2. Start checkout</h2>
      <p>
        Use a route handler when a form or a client fetch triggers checkout. It
        runs on the server, can read secrets, and can redirect the browser.
      </p>

      <CodeBlock
        filename="app/api/checkout/route.ts"
        language="ts"
        code={`import { NextResponse } from "next/server"
import { isOBHPaymentsError } from "@obh/payments"

import { obh } from "@/lib/obh"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  const { orderId } = (await request.json()) as { orderId: string }

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
  })

  try {
    const payment = await obh.startPayment({
      externalOrderId: order.number,
      amount: order.total,
      currency: "IRR",
      description: order.title,
      returnUrl: new URL(
        "/payments/return",
        request.url
      ).toString(),
      metadata: { orderId: order.id },
      idempotencyKey: \`order-\${order.id}-attempt-\${order.attempt}\`,
    })

    await db.order.update({
      where: { id: order.id },
      data: { paymentReference: payment.reference },
    })

    if (!payment.checkoutUrl) {
      return NextResponse.json({ reference: payment.reference })
    }

    return NextResponse.json({ checkoutUrl: payment.checkoutUrl })
  } catch (error) {
    if (isOBHPaymentsError(error)) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          requestId: error.requestId,
        },
        { status: error.status ?? 502 }
      )
    }

    throw error
  }
}`}
      />

      <Callout variant="note" title="Return URL must be allowlisted">
        <p>
          The URL built above must exactly match the service allowlist in OBH
          Admin. Building it from <code>request.url</code> is convenient, but
          check the origin in production — proxies and preview deployments can
          change it.
        </p>
      </Callout>

      <h2 id="return-page">3. The return page</h2>
      <p>
        In Next.js 16, <code>searchParams</code> is a promise. Read the
        reference, retrieve the payment, and render based on the status. The
        page is dynamic because it reads search params, so it will not be
        statically cached with a stale status.
      </p>

      <CodeBlock
        filename="app/payments/return/page.tsx"
        language="tsx"
        code={`import { notFound } from "next/navigation"
import { isOBHPaymentsError, type Payment } from "@obh/payments"

import { obh } from "@/lib/obh"

async function loadPayment(reference: string): Promise<Payment | null> {
  try {
    return await obh.getPayment(reference)
  } catch (error) {
    if (
      isOBHPaymentsError(error) &&
      error.code === "PAYMENT_NOT_FOUND"
    ) {
      return null
    }

    throw error
  }
}

export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>
}) {
  const { reference } = await searchParams

  if (!reference) {
    notFound()
  }

  const payment = await loadPayment(reference)

  if (!payment) {
    notFound()
  }

  if (payment.status === "completed") {
    return (
      <main>
        <h1>Payment confirmed</h1>
        <p>Reference: {payment.reference}</p>
      </main>
    )
  }

  if (payment.status === "pending") {
    return (
      <main>
        <h1>Confirming your payment</h1>
        <p>This usually takes a few seconds. Refresh to check again.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Payment not completed</h1>
      <p>Status: {payment.status}</p>
    </main>
  )
}`}
      />

      <h2 id="fulfilment">4. Idempotent fulfilment</h2>
      <p>
        Both the return page and the webhook will try to fulfil the order. Make
        the database do the arbitration: only one caller may move the order from
        unpaid to paid.
      </p>

      <CodeBlock
        filename="lib/fulfilment.ts"
        language="ts"
        code={`import "server-only"

import { db } from "@/lib/db"

export async function markOrderPaidOnce(reference: string) {
  const updated = await db.order.updateMany({
    where: {
      paymentReference: reference,
      paymentStatus: { not: "paid" },
    },
    data: {
      paymentStatus: "paid",
      paidAt: new Date(),
    },
  })

  if (updated.count === 0) {
    return { fulfilled: false }
  }

  await grantAccess(reference)
  return { fulfilled: true }
}`}
      />

      <p>
        <code>updateMany</code> with a status guard is atomic enough for this
        purpose: the second caller updates zero rows and does not grant access
        twice.
      </p>

      <h2 id="webhook">5. The webhook route</h2>
      <p>
        The full verification code is in{" "}
        <Link href="/webhooks#verify-a-signature">Webhooks</Link>. The route
        uses the Node.js runtime, reads the raw body, verifies the HMAC, claims
        the event id, retrieves the payment, and fulfils.
      </p>

      <CodeBlock
        filename="app/api/webhooks/obh/route.ts"
        language="ts"
        code={`export const runtime = "nodejs"

// The handler from the Webhooks page:
// - reads request.text() before JSON.parse
// - checks OBH-Timestamp against a 5-minute window
// - verifies HMAC-SHA256(timestamp + "." + rawBody)
// - claims OBH-Event-Id and returns 2xx`}
      />

      <h2 id="pitfalls">Next.js pitfalls</h2>
      <Steps>
        <Step number={1} title="“use client” at the top of the module">
          <p>
            A client component cannot read server environment variables, and
            the SDK throws in a browser. Move the call behind a route handler or
            server action.
          </p>
        </Step>
        <Step number={2} title="Passing the client to a client component">
          <p>
            The client instance closes over the secret. Pass only plain data —
            a checkout URL, a reference, or a status string.
          </p>
        </Step>
        <Step number={3} title="Caching a payment response">
          <p>
            Do not wrap <code>getPayment</code> in <code>use cache</code> or a
            long-lived fetch cache. A cached <code>pending</code> can outlive
            the payment. Keep status reads uncached.
          </p>
        </Step>
        <Step number={4} title="Using the browser return URL as state">
          <p>
            The return page can be refreshed or opened by anyone. It must
            retrieve the payment; it must not set the order to paid based on the
            URL alone.
          </p>
        </Step>
        <Step number={5} title="Forgetting the Node.js runtime for the webhook">
          <p>
            HMAC verification uses <code>node:crypto</code>. Declare{" "}
            <code>export const runtime = "nodejs"</code> unless you rewrite the
            comparison with Web Crypto.
          </p>
        </Step>
      </Steps>

      <h2 id="deploy">Deployment checklist</h2>
      <ul>
        <li>
          Set <code>OBH_SERVICE_KEY</code> and <code>OBH_WEBHOOK_SECRET</code>{" "}
          as server-side secrets (and set <code>OBH_SIMULATOR=&quot;false&quot;</code>{" "}
          or omit it in production).
        </li>
        <li>Register the exact production return URL in OBH Admin.</li>
        <li>Register the webhook URL and create a signing secret.</li>
        <li>Schedule the webhook retry worker if you run OBH yourself.</li>
        <li>Alert on repeated <code>AUTH_INVALID</code> or signature failures.</li>
        <li>
          Confirm the SDK runs on a Node.js runtime; edge is not officially
          tested.
        </li>
        <li>
          Remember: no LIVE credential exists yet. Do not enable real checkout
          without an authorized live adapter.
        </li>
      </ul>
    </DocPage>
  )
}

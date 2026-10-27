import type { Metadata } from "next"
import { CircleCheck, Terminal } from "lucide-react"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { Step, Steps } from "@/components/steps"
import { Table } from "@/components/table"

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Install @obhco/payments, configure a service credential, and accept your first test payment.",
}

const sections = [
  { id: "before-you-begin", title: "Before you begin" },
  { id: "install", title: "1. Install the package" },
  { id: "credentials", title: "2. Add your credentials" },
  { id: "client", title: "3. Create the client" },
  { id: "create-your-first-payment", title: "4. Create a payment" },
  { id: "read-the-result", title: "5. Verify the result" },
  { id: "checklist", title: "Checklist" },
  { id: "common-mistakes", title: "Common mistakes" },
]

export default function QuickstartPage() {
  return (
    <DocPage
      href="/quickstart"
      eyebrow="Getting started"
      title="Quickstart"
      description={
        <>
          From an empty project to a verified test payment. This takes about
          ten minutes and needs one server-side credential — no provider
          account, no dashboard setup.
        </>
      }
      sections={sections}
    >
      <h2 id="before-you-begin">Before you begin</h2>
      <Table
        head={
          <>
            <th>Requirement</th>
            <th>Why</th>
          </>
        }
      >
        <tr>
          <td>
            <span className="text-foreground">Node.js 20 or newer</span>
          </td>
          <td>
            The package uses modern <code>fetch</code> and Web Crypto APIs.
          </td>
        </tr>
        <tr>
          <td>
            <span className="text-foreground">A service credential</span>
          </td>
          <td>
            A key shaped like <code>svc_&lt;id&gt;.&lt;secret&gt;</code>,
            generated automatically when your service is created in OBH Admin.
          </td>
        </tr>
        <tr>
          <td>
            <span className="text-foreground">A return URL</span>
          </td>
          <td>
            An absolute URL registered in the service’s exact allowlist or set
            as its default return URL.
          </td>
        </tr>
        <tr>
          <td>
            <span className="text-foreground">A server runtime</span>
          </td>
          <td>
            A Node.js process, Next.js route handler, server action, worker, or
            similar. Never browser code.
          </td>
        </tr>
      </Table>

      <Callout variant="note" title="No credential yet?">
        <p>
          A service and its TEST credential are created by an OBH administrator
          in OBH Admin. The SDK cannot create credentials, and there is no
          self-service signup.
        </p>
      </Callout>

      <h2 id="install">1. Install the package</h2>
      <p>
        Inside this monorepo the package is available through the workspace.
        From a standalone project, install it with your package manager.
      </p>

      <CodeBlock
        filename="Terminal"
        language="bash"
        code={`# In this monorepo, add the workspace dependency
pnpm --filter web add @obhco/payments@workspace:*

# The package is not on npm yet, so a public install is not possible
# pnpm add @obhco/payments`}
      />

      <p>
        The package is ESM-only and declares <code>"type": "module"</code>. A
        CommonJS project can still use it via dynamic <code>import()</code>,
        but native ESM is the supported path.
      </p>

      <h2 id="credentials">2. Add your credentials</h2>
      <p>
        Keep the service key in server-side environment configuration. The
        secret must never reach a browser bundle, a client component, or a log.
      </p>

      <CodeBlock
        filename=".env.local"
        language="bash"
        code={`# Server-only. Do not prefix with NEXT_PUBLIC_.
OBH_SERVICE_KEY="svc_2f4a9c18e0d14b2a.example-secret-value"
# Optional: set to "true" in local/test environments to use the OBH Sadad simulator
OBH_SIMULATOR="true"`}
      />

      <CodeBlock
        filename="lib/obh.ts"
        language="ts"
        code={`import { OBHPayments } from "@obhco/payments"

// Requests automatically target https://obhco.ir/api/v1
export const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  timeoutMs: 15_000,
})`}
      />

      <Callout variant="warning" title="The browser guard is not a secret manager">
        <p>
          The SDK throws if it detects <code>window</code>, which catches
          accidents early. It cannot prevent a secret that was bundled for the
          client from being read. Store the key in server-only configuration.
        </p>
      </Callout>

      <h2 id="client">3. Create the client</h2>
      <p>
        The constructor validates the credential prefix, the base URL, the
        timeout, and the fetch implementation immediately. Misconfiguration
        fails at startup instead of during a checkout.
      </p>

      <CodeBlock
        filename="TypeScript"
        language="ts"
        code={`import { OBHPayments } from "@obhco/payments"

const obh = new OBHPayments({
  secretKey: "svc_2f4a9c18e0d14b2a.example-secret-value",
})
// Uses https://obhco.ir/api/v1 by default and reads process.env.OBH_SIMULATOR`}
      />

      <p>
        The client is stateless apart from configuration, so you can reuse a
        single instance for the lifetime of the process. See{" "}
        <Link href="/configuration">Configuration</Link> for every option and
        the exact URL rules.
      </p>

      <h2 id="create-your-first-payment">4. Create a payment</h2>
      <p>
        A payment needs an order id from your system, an amount, and a
        description. The return URL tells OBH where the customer should land
        after checkout.
      </p>

      <CodeBlock
        filename="app/checkout/route.ts"
        language="ts"
        code={`import { NextResponse } from "next/server"

import { obh } from "@/lib/obh"

export async function POST(request: Request) {
  const form = await request.formData()
  const orderId = String(form.get("orderId"))

  const payment = await obh.startPayment({
    externalOrderId: orderId,
    amount: "245000000",
    currency: "IRR",
    description: "Annual design workspace",
    returnUrl: "https://igraphical.ir/payments/return",
    metadata: { plan: "annual" },
    // Persist this key with the order before sending the request.
    idempotencyKey: \`order-\${orderId}-attempt-1\`,
  })

  // Save payment.reference next to the order, then send the customer
  // to the provider's checkout page.
  await saveReference(orderId, payment.reference)

  if (payment.checkoutUrl) {
    return NextResponse.redirect(payment.checkoutUrl)
  }

  return NextResponse.json({ payment })
}`}
      />

      <p>
        The response contains a <code>reference</code> that belongs to OBH, and
        usually a <code>checkoutUrl</code>. Some adapters complete the payment
        without a redirect, in which case <code>checkoutUrl</code> is{" "}
        <code>null</code> — always branch on it rather than assuming a redirect
        exists.
      </p>

      <h2 id="read-the-result">5. Verify the result</h2>
      <p>
        When the customer comes back, do not read the URL for a status. Look up
        the payment you stored and ask OBH.
      </p>

      <CodeBlock
        filename="app/payments/return/page.tsx"
        language="tsx"
        code={`import { notFound } from "next/navigation"

import { obh } from "@/lib/obh"

export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>
}) {
  const { reference } = await searchParams

  if (!reference) {
    notFound()
  }

  const payment = await obh.getPayment(reference)

  if (payment.status === "completed") {
    return <p>Thanks — your payment is confirmed.</p>
  }

  if (payment.status === "pending") {
    return <p>Still confirming. This page will update shortly.</p>
  }

  return <p>We could not confirm this payment ({payment.status}).</p>
}`}
      />

      <Callout variant="danger" title="Never fulfil on a redirect alone">
        <p>
          A customer can edit a return URL, replay it, or close the browser
          before the provider confirms anything. Only{" "}
          <code>status === "completed"</code> from{" "}
          <code>getPayment()</code> (or a verified webhook followed by a
          retrieve) is proof of payment.
        </p>
      </Callout>

      <h2 id="checklist">Checklist</h2>
      <div className="not-prose my-5 space-y-2.5">
        {[
          "The credential lives only in server-side configuration.",
          "The base URL is HTTPS outside localhost.",
          "The return URL is registered in the service allowlist.",
          "The payment reference is stored with your order.",
          "Fulfilment happens only after a retrieved status is completed.",
          "An idempotency key is stable for a given order attempt.",
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5">
            <CircleCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-success/80"
            />
            <span className="text-[0.83rem] leading-relaxed text-[#b6b6ae]">
              {item}
            </span>
          </div>
        ))}
      </div>

      <h2 id="common-mistakes">Common mistakes</h2>
      <Steps>
        <Step number={1} title="Importing the SDK in a client component">
          <p>
            A file marked <code>"use client"</code> is built for the browser,
            so the constructor throws. Do the call in a route handler, server
            action, or a module marked <code>server-only</code>.
          </p>
        </Step>
        <Step number={2} title="Using http:// in production">
          <p>
            Only <code>localhost</code>, <code>127.0.0.1</code>, and{" "}
            <code>[::1]</code> may use plain HTTP. Anything else must be{" "}
            <code>https://</code>.
          </p>
        </Step>
        <Step number={3} title="Sending numbers instead of strings">
          <p>
            Amounts are decimal strings: <code>"245000000"</code>, not{" "}
            <code>245000000</code>. This avoids floating-point rounding at the
            boundary.
          </p>
        </Step>
        <Step number={4} title="Generating a new idempotency key on retry">
          <p>
            If a request times out and you retry with a fresh key, OBH may
            create a second payment. Derive the key once and persist it. See{" "}
            <Link href="/idempotency">Idempotency &amp; retries</Link>.
          </p>
        </Step>
      </Steps>

      <p className="mt-8 flex items-center gap-2 text-[0.8rem] text-white/40">
        <Terminal aria-hidden="true" className="size-3.5" />
        Prefer a complete framework example? Read the{" "}
        <Link href="/guides/nextjs">Next.js integration guide</Link>.
      </p>
    </DocPage>
  )
}

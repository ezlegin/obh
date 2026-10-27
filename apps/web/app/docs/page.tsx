import type { Metadata } from "next"
import {
  ArrowRight,
  CircleCheck,
  CircleSlash,
  CreditCard,
  KeyRound,
  Package,
  RefreshCw,
  Server,
  ShieldCheck,
  Webhook,
} from "lucide-react"
import Link from "next/link"

import { Callout } from "@/components/docs/callout"
import { CodeBlock } from "@/components/docs/code-block"
import { CardGrid, LinkCard } from "@/components/docs/content"
import { DocPage } from "@/components/docs/doc-page"

export const metadata: Metadata = {
  title: "Introduction",
  description:
    "What the OBH Payments SDK is, what it guarantees, and how it fits into a payment flow.",
}

const sections = [
  { id: "what-is-this", title: "What this package is" },
  { id: "status", title: "Project status" },
  { id: "sixty-seconds", title: "Sixty-second example" },
  { id: "the-one-rule", title: "The one rule" },
  { id: "design-principles", title: "Design principles" },
  { id: "in-the-box", title: "What is in the box" },
  { id: "not-in-the-box", title: "What is not in the box" },
  { id: "next-steps", title: "Next steps" },
]

const statusFacts = [
  { label: "Package version", value: "0.1.0" },
  { label: "Published to npm", value: "Yes — @obhco/payments@0.1.0" },
  { label: "Environment", value: "TEST only" },
  { label: "Real provider tested", value: "No" },
  { label: "Runtime", value: "Node.js 20+" },
  { label: "Dependencies", value: "None at runtime" },
]

export default function IntroductionPage() {
  return (
    <DocPage
      href="/docs/docs"
      eyebrow="Documentation"
      title="OBH Payments SDK"
      description={
        <>
          A small, server-side TypeScript SDK for the versioned OBH payment API.
          It creates a payment, gives your customer a checkout URL, and tells
          you — authoritatively — whether that payment succeeded.
        </>
      }
      sections={sections}
    >
      <h2 id="what-is-this">What this package is</h2>
      <p>
        <code>@obhco/payments</code> is the official client for talking to OBH
        from one of the connected services in the OBH ecosystem. If your
        application needs to charge a customer and record the result, this
        package is the supported path.
      </p>
      <p>
        It is deliberately small. There are two operations, one response shape,
        and one error class. Everything else — provider accounts, credentials,
        verification, webhook delivery, accounting — lives on the OBH server,
        behind the API.
      </p>

      <CardGrid>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <CreditCard aria-hidden="true" className="size-4 text-white/45" />
          <p className="mt-3 text-[0.85rem] font-medium text-foreground">
            Create a payment
          </p>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted-foreground">
            Send an order id, an amount, and a description. Receive a payment
            with a reference and, usually, a checkout URL.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <CircleCheck aria-hidden="true" className="size-4 text-white/45" />
          <p className="mt-3 text-[0.85rem] font-medium text-foreground">
            Check the result
          </p>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted-foreground">
            Fetch the payment by its OBH reference and read a status that was
            verified on the server, not in the browser.
          </p>
        </div>
      </CardGrid>

      <h2 id="status">Project status</h2>
      <p>
        Read this before planning an integration. The SDK is complete enough to
        review and to integrate in a test environment, but it has not been used
        for a real payment.
      </p>

      <div className="not-prose my-6 grid gap-3 sm:grid-cols-2">
        {statusFacts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-white/[0.015] px-3.5 py-2.5"
          >
            <span className="text-[0.75rem] text-muted-foreground">
              {fact.label}
            </span>
            <span className="text-right font-mono text-[0.72rem] text-white/75">
              {fact.value}
            </span>
          </div>
        ))}
      </div>

      <Callout variant="warning" title="Do not treat this as production-ready">
        <p>
          Version 0.1.0 has been tested against the local OBH API and the
          development adapter only. No real payment provider has been contacted,
          and LIVE credentials are not issued. Do not publish the package or
          promise live payments without an authorized environment test.
        </p>
      </Callout>

      <h2 id="sixty-seconds">Sixty-second example</h2>
      <p>
        This is the entire integration in miniature. Create a client once at
        startup, create a payment when an order is placed, then verify the
        status on your server before fulfilling anything.
      </p>

      <CodeBlock
        filename="checkout.ts"
        language="ts"
        code={`import { OBHPayments, isOBHPaymentsError } from "@obhco/payments"

const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
})

export async function beginCheckout(orderId: string) {
  try {
    const payment = await obh.startPayment({
      externalOrderId: orderId,
      amount: "245000000",
      currency: "IRR",
      description: "Annual design workspace",
      returnUrl: "https://igraphical.ir/payments/return",
      metadata: { plan: "annual" },
      // Stable per order attempt, so a retry cannot double-charge.
      idempotencyKey: \`order-\${orderId}-attempt-1\`,
    })

    // Store payment.reference with the order.
    return payment.checkoutUrl
  } catch (error) {
    if (isOBHPaymentsError(error)) {
      console.error(error.code, error.status, error.requestId)
    }
    throw error
  }
}`}
      />

      <CodeBlock
        filename="return-page.ts"
        language="ts"
        code={`// Never trust ?status=completed in the return URL.
const payment = await obh.getPayment(storedReference)

if (payment.status === "completed") {
  await markOrderPaid(payment.externalOrderId!)
}`}
      />

      <p>
        The two calls map to two HTTP endpoints:{" "}
        <code>POST /api/v1/payments</code> and{" "}
        <code>GET /api/v1/payments/&#123;reference&#125;</code>. You can use the
        SDK or call them directly — see the{" "}
        <Link href="/docs/api-reference">API reference</Link>.
      </p>

      <h2 id="the-one-rule">The one rule: the server decides</h2>
      <p>
        A customer returning to your site does not prove that money moved. A
        query parameter does not prove it either. Only OBH’s server-side
        verification can set a payment to <code>completed</code>.
      </p>
      <p>
        That is why the SDK has no browser build and refuses to construct in a
        browser. Your client-side code should redirect to{" "}
        <code>checkoutUrl</code> and then show a waiting screen; the
        authoritative decision happens in a server process.
      </p>

      <Callout variant="tip" title="A useful habit">
        <p>
          Write your return page as if it were an untrusted stranger: read the
          stored reference, call <code>getPayment</code>, and branch only on the
          returned <code>status</code>. Treat the URL as a hint about which
          order to look at, never as evidence.
        </p>
      </Callout>

      <h2 id="design-principles">Design principles</h2>
      <div className="not-prose my-6 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2">
        {[
          {
            icon: Server,
            title: "Server-side by default",
            body: "The constructor throws in a browser. Credentials never leave your backend.",
          },
          {
            icon: ShieldCheck,
            title: "Verification beats redirects",
            body: "Statuses come from OBH after provider verification, not from the return URL.",
          },
          {
            icon: RefreshCw,
            title: "Safe retries",
            body: "Every create request carries an idempotency key, so retries return the original payment.",
          },
          {
            icon: KeyRound,
            title: "Small, typed surface",
            body: "Two methods, explicit types, and one error class with machine-readable codes.",
          },
        ].map((principle) => (
          <div key={principle.title} className="bg-[#0a0a0a] p-4">
            <principle.icon
              aria-hidden="true"
              className="size-4 text-white/45"
            />
            <p className="mt-3 text-[0.83rem] font-medium text-foreground">
              {principle.title}
            </p>
            <p className="mt-1.5 text-[0.76rem] leading-relaxed text-muted-foreground">
              {principle.body}
            </p>
          </div>
        ))}
      </div>

      <h2 id="in-the-box">What is in the box</h2>
      <ul>
        <li>
          <code>OBHPayments</code> — the client, configured once with your
          service credential.
        </li>
        <li>
          <code>startPayment()</code> — creates a payment and returns a checkout
          URL when the provider needs one.
        </li>
        <li>
          <code>getPayment()</code> — reads one payment by its OBH reference.
        </li>
        <li>
          <code>OBHPaymentsError</code> and <code>isOBHPaymentsError()</code> —
          typed failures with <code>code</code>, <code>status</code>,{" "}
          <code>requestId</code>, <code>details</code>, and{" "}
          <code>retryable</code>.
        </li>
        <li>
          Types: <code>Payment</code>, <code>StartPaymentInput</code>,{" "}
          <code>OBHPaymentsOptions</code>, and <code>PaymentStatus</code>.
        </li>
      </ul>
      <p>
        Runtime dependencies: <strong>none</strong>. It uses the platform{" "}
        <code>fetch</code>, <code>AbortController</code>, and{" "}
        <code>crypto.randomUUID</code>.
      </p>

      <h2 id="not-in-the-box">What is not in the box</h2>
      <ul>
        <li>Provider adapters, provider credentials, or provider SDKs.</li>
        <li>Database access, refunds, subscriptions, or invoices.</li>
        <li>
          Webhook signature verification — that is your job, with your secret.
        </li>
        <li>
          Cancellation, capture, or partial refunds. The API exposes none of
          these.
        </li>
        <li>Browser support. There is no browser entrypoint.</li>
      </ul>
      <p>
        Those boundaries are intentional: they keep provider secrets and
        financial state on the OBH server, where they can be verified and
        audited.
      </p>

      <h2 id="next-steps">Next steps</h2>
      <CardGrid>
        <LinkCard
          href="/docs/quickstart"
          title="Quickstart"
          icon={<ArrowRight className="size-4" />}
        >
          Install the package and create your first test payment in five steps.
        </LinkCard>
        <LinkCard
          href="/docs/concepts"
          title="How payments work"
          icon={<Package className="size-4" />}
        >
          The cast of actors, the lifecycle, and the statuses explained.
        </LinkCard>
        <LinkCard
          href="/docs/api-reference"
          title="API reference"
          icon={<Webhook className="size-4" />}
        >
          Every method, every field, and the HTTP contract underneath.
        </LinkCard>
        <LinkCard
          href="/docs/security"
          title="Security model"
          icon={<CircleSlash className="size-4" />}
        >
          What OBH protects, and what your integration must protect.
        </LinkCard>
      </CardGrid>
    </DocPage>
  )
}

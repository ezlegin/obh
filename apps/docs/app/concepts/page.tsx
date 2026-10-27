import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { LifecycleDiagram } from "@/components/lifecycle-diagram"
import { StatusPill } from "@/components/status-pill"
import { Table } from "@/components/table"

export const metadata: Metadata = {
  title: "How payments work",
  description:
    "The actors in an OBH payment, the lifecycle of a payment, and why the server is the source of truth.",
}

const sections = [
  { id: "the-cast", title: "The cast of a payment" },
  { id: "the-flow", title: "The flow, step by step" },
  { id: "payment-object", title: "The payment object" },
  { id: "payment-statuses", title: "Payment statuses" },
  { id: "money", title: "Money" },
  { id: "environments", title: "Environments" },
  { id: "source-of-truth", title: "The source of truth" },
]

const cast = [
  {
    name: "Customer",
    code: "browser",
    body: "Chooses to pay and is redirected to the provider’s checkout. The browser is untrusted.",
  },
  {
    name: "Your server",
    code: "@obhco/payments",
    body: "Creates the payment with your service credential, stores the reference, and verifies status.",
  },
  {
    name: "OBH API",
    code: "/api/v1",
    body: "Owns the payment record, the provider account, verification, and webhook delivery.",
  },
  {
    name: "Provider",
    code: "server-side only",
    body: "Collects the money. Its credentials never leave OBH; its result is verified by OBH.",
  },
]

export default function ConceptsPage() {
  return (
    <DocPage
      href="/concepts"
      eyebrow="Getting started"
      title="How payments work"
      description={
        <>
          Four actors, one record, five statuses. Understanding this page makes
          every other page easier: it explains where your code sits and why the
          server — not the redirect — is the source of truth.
        </>
      }
      sections={sections}
    >
      <h2 id="the-cast">The cast of a payment</h2>
      <div className="not-prose my-6 overflow-hidden rounded-xl border border-white/10">
        {cast.map((actor, index) => (
          <div
            key={actor.name}
            className={`grid gap-1.5 px-4 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4 ${
              index > 0 ? "border-t border-white/[0.07]" : ""
            }`}
          >
            <div>
              <p className="text-[0.83rem] font-medium text-foreground">
                {actor.name}
              </p>
              <p className="mt-0.5 font-mono text-[0.62rem] text-white/35">
                {actor.code}
              </p>
            </div>
            <p className="text-[0.79rem] leading-relaxed text-muted-foreground">
              {actor.body}
            </p>
          </div>
        ))}
      </div>

      <p>
        Your integration only ever talks to the OBH API. The provider is OBH’s
        concern: OBH chooses the provider account, stores its credentials,
        creates the checkout session, and verifies the result. You never pass a
        provider token, and the SDK has no provider code in it.
      </p>

      <h2 id="the-flow">The flow, step by step</h2>
      <ol>
        <li>
          <strong>Your server creates the payment.</strong> You call{" "}
          <code>startPayment()</code> with an order id, amount, and
          description. OBH stores a payment in <code>pending</code> and returns
          its <code>reference</code> plus, usually, a <code>checkoutUrl</code>.
        </li>
        <li>
          <strong>The customer pays.</strong> You redirect the browser to the
          checkout URL. The provider handles the actual payment UI.
        </li>
        <li>
          <strong>The customer returns.</strong> The provider sends the browser
          to your <code>returnUrl</code>. This is a <em>hint</em>, not proof.
        </li>
        <li>
          <strong>OBH verifies it.</strong> OBH talks to the provider from the
          server and decides whether the payment succeeded.
        </li>
        <li>
          <strong>You read the result.</strong> Call <code>getPayment()</code>{" "}
          with the stored reference, or wait for a signed webhook and then
          retrieve. Terminal statuses never change again.
        </li>
      </ol>

      <Callout variant="note" title="Why verify after a webhook too?">
        <p>
          Webhooks can arrive out of order, more than once, or after a delayed
          retry. They tell you <em>that something happened</em>;{" "}
          <code>getPayment()</code> tells you <em>what is true now</em>. Use the
          event as a trigger to retrieve, not as the state itself.
        </p>
      </Callout>

      <h2 id="payment-object">The payment object</h2>
      <p>
        Every method returns the same shape. Additional fields may be added in
        the future without breaking your integration, so ignore unknown ones.
      </p>

      <Table
        head={
          <>
            <th>Field</th>
            <th>Type</th>
            <th>Meaning</th>
          </>
        }
      >
        {[
          ["id", "string", "Internal payment identifier."],
          ["reference", "string", "OBH reference used to retrieve the payment."],
          ["service", "string", "The authenticated service that owns the payment."],
          ["externalOrderId", "string | null", "Your order id, echoed back."],
          ["amount", "string", "Decimal amount, always a string."],
          ["currency", "string", "Currently always IRR."],
          ["environment", "test | live", "Which financial environment owns the record."],
          ["status", "PaymentStatus", "The verified lifecycle state."],
          ["description", "string", "The description you supplied."],
          ["checkoutUrl", "string | null", "Provider checkout URL, when one exists."],
          ["createdAt", "string", "RFC 3339 UTC timestamp."],
          ["completedAt", "string | null", "When the payment completed, if it did."],
          ["verifiedAt", "string | null", "When server-side verification last ran."],
        ].map(([field, type, meaning]) => (
          <tr key={field}>
            <td>
              <code>{field}</code>
            </td>
            <td>
              <code>{type}</code>
            </td>
            <td>{meaning}</td>
          </tr>
        ))}
      </Table>

      <p>
        Timestamps are RFC 3339 UTC strings. Store them as timestamps, not as
        localized display strings.
      </p>

      <h2 id="payment-statuses">Payment statuses</h2>
      <p>
        There are exactly five statuses. Three of them are terminal, and{" "}
        <code>pending</code> is the only non-terminal one.
      </p>

      <LifecycleDiagram />

      <Table
        head={
          <>
            <th>Status</th>
            <th>Meaning</th>
            <th>Terminal</th>
          </>
        }
      >
        <tr>
          <td>
            <StatusPill status="pending" />
          </td>
          <td>
            A provider session exists or is being created; the result is
            unverified.
          </td>
          <td>No</td>
        </tr>
        <tr>
          <td>
            <StatusPill status="completed" />
          </td>
          <td>Server-side provider verification succeeded.</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>
            <StatusPill status="failed" />
          </td>
          <td>Verification or provider processing failed.</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>
            <StatusPill status="cancelled" />
          </td>
          <td>Cancelled by an authorized process.</td>
          <td>Yes</td>
        </tr>
        <tr>
          <td>
            <StatusPill status="expired" />
          </td>
          <td>Checkout or session expired without success.</td>
          <td>Yes</td>
        </tr>
      </Table>

      <p>
        Do not build business logic on the exact wording of a status. Build it
        on three questions: is it <code>completed</code>? is it{" "}
        <code>pending</code>? or is it a terminal non-success?
      </p>

      <CodeBlock
        filename="Fulfilment rule"
        language="ts"
        code={`if (payment.status === "completed") {
  await fulfilOrder(payment.externalOrderId)
} else if (payment.status === "pending") {
  await showPendingScreen(payment.reference)
} else {
  await showFailureScreen(payment.status)
}`}
      />

      <h2 id="money">Money</h2>
      <p>
        Amounts are <strong>decimal strings</strong>, never JavaScript numbers.
        One rial is one unit; there are no minor units to divide by 100.
      </p>
      <ul>
        <li>
          Currency is fixed to <code>IRR</code>. No conversion is performed.
        </li>
        <li>
          The amount must be positive, with up to two decimal places and at
          most 18 integer digits.
        </li>
        <li>
          <code>"245000000"</code> and <code>"1000.50"</code> are valid.{" "}
          <code>245000000</code> and <code>"0"</code> are not.
        </li>
        <li>
          Responses always normalize the amount to two decimal places: sending{" "}
          <code>"245000000"</code> returns <code>"245000000.00"</code>. Compare
          amounts after normalization, not as the raw string you sent.
        </li>
      </ul>
      <p>
        Keep the amount as a string all the way from your order to the API.
        Parsing it into a float to “clean it up” is how rounding bugs and
        mismatched orders appear.
      </p>

      <h2 id="environments">Environments</h2>
      <p>
        Every payment belongs to an environment, and every credential is bound
        to one:
      </p>

      <CodeBlock
        language="text"
        code={`TEST key:  svc_test_<key-id>.<secret>
LIVE key:  svc_live_<key-id>.<secret>`}
        showLineNumbers={false}
      />

      <p>
        Today only TEST credentials are issued. A TEST payment record can never
        become a LIVE financial record, and a TEST key cannot read or write LIVE
        data. The <code>environment</code> field on a payment tells you which
        world you are in.
      </p>

      <Callout variant="warning" title="Test money is real-looking, but not real">
        <p>
          The development adapter simulates a checkout locally and marks its
          results as simulated. It never contacts a provider. Do not reconcile
          test payments as revenue.
        </p>
      </Callout>

      <h2 id="source-of-truth">The source of truth</h2>
      <p>
        There are three ways a payment result can reach your application, and
        they are not equally trustworthy:
      </p>
      <ol>
        <li>
          <strong>The return URL</strong> — a browser navigation. Useful for
          routing; worthless as evidence.
        </li>
        <li>
          <strong>A webhook</strong> — a signed server-to-server notification.
          Trustworthy as a signal, but it can be delayed or duplicated.
        </li>
        <li>
          <strong><code>getPayment()</code></strong> — a fresh read from OBH.
          This is the authoritative state.
        </li>
      </ol>
      <p>
        Call <code>getPayment()</code> before granting access, shipping a
        product, or recording revenue. If a webhook told you the payment
        completed, retrieve it once more and check.
      </p>

      <p>
        Next, put this into practice:{" "}
        <Link href="/payments/create">Create a payment</Link>.
      </p>
    </DocPage>
  )
}

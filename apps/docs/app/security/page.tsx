import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { Table } from "@/components/table"

export const metadata: Metadata = {
  title: "Security",
  description:
    "Trust boundaries, credential handling, redirect safety, webhook verification, and logging rules.",
}

const sections = [
  { id: "trust-boundaries", title: "Trust boundaries" },
  { id: "your-responsibilities", title: "Your responsibilities" },
  { id: "credentials", title: "Credentials" },
  { id: "redirects", title: "Redirects and return URLs" },
  { id: "metadata", title: "Metadata and customer input" },
  { id: "webhooks", title: "Webhooks" },
  { id: "logging", title: "Logging" },
  { id: "threats", title: "Threat model" },
  { id: "checklist", title: "Security checklist" },
]

export default function SecurityPage() {
  return (
    <DocPage
      href="/security"
      eyebrow="Operations"
      title="Security"
      description={
        <>
          OBH keeps provider credentials and financial verification on the
          server. Your integration is responsible for a different half: keeping
          the service key server-side, not trusting the browser, and verifying
          webhooks.
        </>
      }
      sections={sections}
    >
      <h2 id="trust-boundaries">Trust boundaries</h2>
      <div className="not-prose my-6 overflow-hidden rounded-xl border border-white/10">
        {[
          {
            zone: "Untrusted",
            items: "Browser, return URL, query parameters, customer input, webhook payloads before verification",
          },
          {
            zone: "Your server",
            items: "Service credential, order records, idempotency keys, webhook secret, fulfilment logic",
          },
          {
            zone: "OBH server",
            items: "Provider credentials, provider accounts, verification, payment records, delivery workers",
          },
        ].map((row, index) => (
          <div
            key={row.zone}
            className={`grid gap-1.5 px-4 py-3.5 sm:grid-cols-[8rem_1fr] sm:gap-4 ${
              index > 0 ? "border-t border-white/[0.07]" : ""
            }`}
          >
            <p className="font-mono text-[0.68rem] tracking-wide text-white/45 uppercase">
              {row.zone}
            </p>
            <p className="text-[0.79rem] leading-relaxed text-muted-foreground">
              {row.items}
            </p>
          </div>
        ))}
      </div>

      <p>
        The SDK lives entirely in “your server”. It never exposes a browser
        entrypoint, and the service key must never cross into the “untrusted”
        zone.
      </p>

      <h2 id="your-responsibilities">Your responsibilities</h2>
      <ol>
        <li>
          <strong>Keep the service key server-side.</strong> No{" "}
          <code>NEXT_PUBLIC_</code> variables, no client bundles, no logs.
        </li>
        <li>
          <strong>Verify before fulfilling.</strong> Retrieve the payment and
          require <code>completed</code>.
        </li>
        <li>
          <strong>Fulfil idempotently.</strong> A return page, a webhook, and a
          retry can all race.
        </li>
        <li>
          <strong>Verify webhook signatures.</strong> With the webhook secret
          over the raw body, plus a timestamp tolerance.
        </li>
        <li>
          <strong>Deduplicate events.</strong> By <code>OBH-Event-Id</code>.
        </li>
        <li>
          <strong>Validate your own user input.</strong> The SDK validates the
          payment shape, not your authorization model.
        </li>
      </ol>

      <h2 id="credentials">Credentials</h2>
      <p>
        Credentials look like <code>svc_test_&lt;key-id&gt;.&lt;secret&gt;</code>
        . The key id is public; the secret is shown once at issuance. OBH stores
        only a SHA-256 digest and compares it in constant time.
      </p>
      <ul>
        <li>Credentials are revocable; revocation applies on the next request.</li>
        <li>
          TEST credentials are the only ones issued. A TEST key cannot produce
          LIVE financial records.
        </li>
        <li>
          The credential identifies the service. It cannot be used to select a
          different originating service.
        </li>
        <li>
          Rotate a credential if it may have leaked. There is no way to recover
          a secret.
        </li>
      </ul>

      <CodeBlock
        filename="Do"
        language="ts"
        code={`// Server-only module, imported by route handlers and server components.
import "server-only"

export const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: process.env.OBH_API_URL!,
})`}
      />

      <CodeBlock
        filename="Do not"
        language="ts"
        code={`// Exposed to the browser bundle. This key is compromised.
const key = process.env.NEXT_PUBLIC_OBH_SERVICE_KEY

// Logged on every request.
console.log("auth", \`Bearer \${process.env.OBH_SERVICE_KEY}\`)`}
      />

      <h2 id="redirects">Redirects and return URLs</h2>
      <p>
        The return URL is a navigation hint, not a security control. OBH
        restricts redirects to an exact allowlist, which prevents open
        redirects — but it cannot make the resulting browser navigation
        trustworthy.
      </p>
      <Callout variant="danger" title="The classic mistake">
        <p>
          A return page reads <code>?status=completed</code> and grants access.
          An attacker can open that URL without paying. Always look up the
          stored reference and retrieve the status from OBH.
        </p>
      </Callout>

      <p>
        Register exact URLs, not wildcards or prefixes. The API rejects anything
        that is not an exact match with <code>RETURN_URL_NOT_ALLOWED</code>.
        Avoid putting sensitive data in the return URL; it is visible in browser
        history, referrers, and logs.
      </p>

      <h2 id="metadata">Metadata and customer input</h2>
      <p>
        Metadata is informational and visible to operators. It must never
        decide authorization, the amount, the currency, or the lifecycle. Treat
        it like a comment attached to the payment.
      </p>
      <ul>
        <li>Maximum 8 KB when serialized.</li>
        <li>Must be a JSON object, not an array or a scalar.</li>
        <li>No secrets, tokens, or card data.</li>
        <li>Validate and normalize it on your side before sending.</li>
      </ul>
      <p>
        Amount and currency come from your server-side order record, not from
        the browser. A client-submitted price is a client-submitted discount.
      </p>

      <h2 id="webhooks">Webhooks</h2>
      <p>
        The signing secret is per service and separate from the API credential.
        Verify HMAC-SHA256 over{" "}
        <code>&lt;timestamp&gt;.&lt;raw body&gt;</code> with a timing-safe
        comparison, reject stale timestamps, and deduplicate by event id.
      </p>
      <p>
        The full algorithm and a working handler are in{" "}
        <Link href="/webhooks#verify-a-signature">Webhooks</Link>. Two rules are
        worth repeating:
      </p>
      <ul>
        <li>Read the raw body before parsing; re-serialization changes bytes.</li>
        <li>Use <code>timingSafeEqual</code>, not <code>===</code>.</li>
      </ul>

      <h2 id="logging">Logging</h2>
      <Table
        head={
          <>
            <th>Log this</th>
            <th>Never log this</th>
          </>
        }
      >
        <tr>
          <td>Error code, HTTP status, request id</td>
          <td>Service secret or Authorization header</td>
        </tr>
        <tr>
          <td>Your order id and payment reference</td>
          <td>Webhook signing secret</td>
        </tr>
        <tr>
          <td>Duration, retry attempt, outcome</td>
          <td>Full request bodies with sensitive metadata</td>
        </tr>
        <tr>
          <td>Event id for webhooks</td>
          <td>Raw signature of a valid request</td>
        </tr>
      </Table>

      <p>
        Also be careful with third-party error trackers: request objects and
        headers are frequently captured by default. Scrub{" "}
        <code>authorization</code> and any <code>svc_</code> values before
        reporting.
      </p>

      <h2 id="threats">Threat model</h2>
      <Table
        head={
          <>
            <th>Risk</th>
            <th>Mitigation</th>
          </>
        }
      >
        <tr>
          <td>Secret leaked to the browser</td>
          <td>
            Server-only modules, no public env prefix, SDK browser guard,
            review bundles.
          </td>
        </tr>
        <tr>
          <td>Fulfilling an unpaid order</td>
          <td>
            Retrieve the payment, require <code>completed</code>, ignore return
            URL state.
          </td>
        </tr>
        <tr>
          <td>Double fulfilment</td>
          <td>Idempotent database transition keyed by payment reference.</td>
        </tr>
        <tr>
          <td>Double charge on retry</td>
          <td>Stable idempotency key, persisted before the request.</td>
        </tr>
        <tr>
          <td>Forged webhook</td>
          <td>Verify HMAC with the webhook secret and a timestamp window.</td>
        </tr>
        <tr>
          <td>Replayed webhook</td>
          <td>Deduplicate event ids; make fulfilment idempotent.</td>
        </tr>
        <tr>
          <td>Cross-service data access</td>
          <td>
            OBH scopes every read and idempotency ledger to the authenticated
            service.
          </td>
        </tr>
        <tr>
          <td>Price tampering</td>
          <td>Read the amount from the server-side order, never from the client.</td>
        </tr>
        <tr>
          <td>Open redirect</td>
          <td>Exact return URL allowlist, enforced by the API.</td>
        </tr>
        <tr>
          <td>Insecure transport</td>
          <td>HTTPS required; HTTP only on localhost development.</td>
        </tr>
      </Table>

      <h2 id="checklist">Security checklist</h2>
      <ul>
        <li>The SDK is imported only from server-only modules.</li>
        <li>No secret is in a client bundle, log, or error tracker.</li>
        <li>Fulfilment requires a retrieved <code>completed</code> status.</li>
        <li>Fulfilment is idempotent on the payment reference.</li>
        <li>Webhook HMAC and timestamp are verified before parsing.</li>
        <li>Webhook event ids are deduplicated.</li>
        <li>Return URLs are exact and allowlisted.</li>
        <li>Amounts come from server-side order data.</li>
        <li>Credentials can be revoked and rotated without downtime.</li>
      </ul>
    </DocPage>
  )
}

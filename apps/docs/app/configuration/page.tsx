import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/callout"
import { CodeBlock } from "@/components/code-block"
import { DocPage } from "@/components/doc-page"
import { PropsTable, Table } from "@/components/table"

export const metadata: Metadata = {
  title: "Configuration",
  description:
    "Client options, base URL normalization, timeouts, custom fetch, and server-only guarantees.",
}

const sections = [
  { id: "client-options", title: "Client options" },
  { id: "base-url-rules", title: "Base URL rules" },
  { id: "timeouts", title: "Timeouts" },
  { id: "custom-fetch", title: "Custom fetch" },
  { id: "server-only", title: "Server-only guard" },
  { id: "environment-variables", title: "Environment variables" },
  { id: "multiple-services", title: "Multiple services" },
  { id: "runtime", title: "Runtime and module format" },
]

export default function ConfigurationPage() {
  return (
    <DocPage
      href="/configuration"
      eyebrow="Reference"
      title="Configuration"
      description={
        <>
          Everything the client accepts, how the base URL is normalized, and
          the checks that run in the constructor. Configuration errors fail
          immediately instead of halfway through a checkout.
        </>
      }
      sections={sections}
    >
      <h2 id="client-options">Client options</h2>
      <CodeBlock
        language="ts"
        code={`new OBHPayments(options: OBHPaymentsOptions)

type OBHPaymentsOptions = {
  secretKey: string
  baseUrl: string
  timeoutMs?: number
  fetch?: typeof fetch
}`}
      />

      <PropsTable
        rows={[
          {
            name: "secretKey",
            type: "string",
            required: true,
            description:
              "A server-side service credential beginning with svc_. The constructor rejects anything else.",
          },
          {
            name: "baseUrl",
            type: "string",
            required: true,
            description:
              "Absolute OBH origin. HTTPS is required except for localhost development. /api/v1 is appended automatically.",
          },
          {
            name: "timeoutMs",
            type: "number",
            required: false,
            defaultValue: "15000",
            description:
              "Per-request timeout in milliseconds. Must be a finite positive number.",
          },
          {
            name: "fetch",
            type: "typeof fetch",
            required: false,
            defaultValue: "globalThis.fetch",
            description:
              "Custom fetch implementation, useful for tests, proxies, or instrumented HTTP clients.",
          },
        ]}
      />

      <p>
        The constructor validates all four options synchronously. A bad
        credential, an unsafe URL, a non-positive timeout, or a missing fetch
        implementation throws before any request is made.
      </p>

      <h2 id="base-url-rules">Base URL rules</h2>
      <p>
        The SDK normalizes <code>baseUrl</code> once, in the constructor. The
        rules are strict on purpose:
      </p>
      <ul>
        <li>It must parse as an absolute URL.</li>
        <li>
          It must not contain credentials, a query string, or a fragment
          (<code>user:pass@</code>, <code>?x=1</code>, <code>#hash</code>).
        </li>
        <li>
          It must use <code>https:</code>, unless the hostname is{" "}
          <code>localhost</code>, <code>127.0.0.1</code>, or <code>[::1]</code>,
          where plain <code>http:</code> is allowed for development.
        </li>
        <li>Trailing slashes are removed.</li>
        <li>
          If the resulting path does not end with <code>/api/v1</code>, that
          suffix is appended.
        </li>
      </ul>

      <Table
        head={
          <>
            <th>You pass</th>
            <th>Requests go to</th>
            <th>Why</th>
          </>
        }
      >
        <tr>
          <td><code>http://localhost:3100</code></td>
          <td><code>http://localhost:3100/api/v1/...</code></td>
          <td>Localhost may use HTTP; suffix appended.</td>
        </tr>
        <tr>
          <td><code>https://pay.obh.example</code></td>
          <td><code>https://pay.obh.example/api/v1/...</code></td>
          <td>Standard production form.</td>
        </tr>
        <tr>
          <td><code>https://pay.obh.example/api/v1</code></td>
          <td><code>https://pay.obh.example/api/v1/...</code></td>
          <td>Already suffixed, not doubled.</td>
        </tr>
        <tr>
          <td><code>https://pay.obh.example/gateway/</code></td>
          <td><code>https://pay.obh.example/gateway/api/v1/...</code></td>
          <td>Trailing slash removed, suffix appended to the path.</td>
        </tr>
        <tr>
          <td><code>http://pay.obh.example</code></td>
          <td>Rejected</td>
          <td>Only localhost may use plain HTTP.</td>
        </tr>
        <tr>
          <td><code>pay.obh.example</code></td>
          <td>Rejected</td>
          <td>Not an absolute URL.</td>
        </tr>
        <tr>
          <td><code>https://pay.obh.example?env=test</code></td>
          <td>Rejected</td>
          <td>Query strings are not allowed.</td>
        </tr>
      </Table>

      <Callout variant="tip" title="Prefer an origin, not an endpoint">
        <p>
          Pass <code>https://pay.obh.example</code> and let the SDK add the
          version. Passing the full endpoint works too, but an origin is harder
          to break when the API version is mentioned elsewhere.
        </p>
      </Callout>

      <h2 id="timeouts">Timeouts</h2>
      <p>
        Each request gets its own <code>AbortController</code> and a timer. The
        default is 15 seconds. When the timer fires, the request is aborted and
        the SDK throws{" "}
        <code>{`{ code: "TIMEOUT", retryable: true }`}</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: process.env.OBH_API_URL!,
  timeoutMs: 10_000,
})`}
      />

      <p>
        A timeout is ambiguous, not a failure: the server may have processed
        the request. For creation, retry with the same idempotency key. For
        retrieval, simply retry.
      </p>

      <h2 id="custom-fetch">Custom fetch</h2>
      <p>
        The package uses the global <code>fetch</code> by default. Supply your
        own to add tracing, route through a proxy, or simulate responses in
        tests.
      </p>
      <CodeBlock
        filename="Instrumented fetch"
        language="ts"
        code={`const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: process.env.OBH_API_URL!,
  fetch: async (input, init) => {
    const startedAt = performance.now()

    try {
      return await fetch(input, init)
    } finally {
      metrics.observe("obh.request.ms", performance.now() - startedAt)
    }
  },
})`}
      />

      <Callout variant="note" title="Your fetch must honour AbortSignal">
        <p>
          The SDK passes <code>signal</code> on every request. A custom fetch
          that ignores it will not time out correctly. If you wrap the platform
          fetch, forward <code>init</code> unchanged apart from what you
          intentionally add.
        </p>
      </Callout>

      <h2 id="server-only">Server-only guard</h2>
      <p>
        The constructor checks for a global <code>window</code> and throws when
        one exists. This is a development guard, not a security boundary: it
        catches the common mistake of importing the SDK into a client
        component.
      </p>
      <CodeBlock
        language="ts"
        code={`// In a browser bundle, this throws:
// "@obh/payments is server-only and must not run in browser code."
const obh = new OBHPayments({ /* ... */ })`}
      />

      <p>
        In Next.js, keep the client in a module that is only imported from
        server code. Adding <code>import "server-only"</code> to that module
        gives you a second, compile-time guard.
      </p>

      <CodeBlock
        filename="lib/obh.ts"
        language="ts"
        code={`import "server-only"

import { OBHPayments } from "@obh/payments"

export const obh = new OBHPayments({
  secretKey: process.env.OBH_SERVICE_KEY!,
  baseUrl: process.env.OBH_API_URL!,
})`}
      />

      <h2 id="environment-variables">Environment variables</h2>
      <p>
        Use names that make the trust boundary obvious. Never use a{" "}
        <code>NEXT_PUBLIC_</code> (or equivalent) prefix for either value.
      </p>

      <Table
        head={
          <>
            <th>Variable</th>
            <th>Purpose</th>
          </>
        }
      >
        <tr>
          <td><code>OBH_SERVICE_KEY</code></td>
          <td>The svc_ credential. Server-only.</td>
        </tr>
        <tr>
          <td><code>OBH_API_URL</code></td>
          <td>
            The API origin. Often public information, but keeping it beside the
            key is simpler.
          </td>
        </tr>
        <tr>
          <td><code>OBH_WEBHOOK_SECRET</code></td>
          <td>
            Used only by your webhook route, never by the SDK.
          </td>
        </tr>
      </Table>

      <Callout variant="warning" title="A missing variable is not a nice error">
        <p>
          If <code>OBH_API_URL</code> is undefined, the constructor throws
          “baseUrl must be an absolute URL.” If{" "}
          <code>OBH_SERVICE_KEY</code> is undefined, it throws “secretKey must
          be an OBH service credential.” Validate configuration at startup so
          you learn about it before a customer does.
        </p>
      </Callout>

      <h2 id="multiple-services">Multiple services</h2>
      <p>
        One client represents one credential, one service, and one origin.
        Create a separate client for each service you operate; do not share a
        key across services.
      </p>
      <CodeBlock
        language="ts"
        code={`export const igraphical = new OBHPayments({
  secretKey: process.env.IGRAPHICAL_SERVICE_KEY!,
  baseUrl: process.env.OBH_API_URL!,
})

export const otherService = new OBHPayments({
  secretKey: process.env.OTHER_SERVICE_KEY!,
  baseUrl: process.env.OBH_API_URL!,
})`}
      />

      <p>
        A service can only see its own payments. Using the wrong client does
        not leak data; it produces <code>404 PAYMENT_NOT_FOUND</code>.
      </p>

      <h2 id="runtime">Runtime and module format</h2>
      <ul>
        <li>
          <strong>Node.js 20+.</strong> The package declares{" "}
          <code>engines.node &gt;= 20</code>.
        </li>
        <li>
          <strong>ESM only.</strong> It exports <code>import</code> with
          TypeScript declarations. CommonJS consumers need a dynamic{" "}
          <code>import()</code> or an ESM entrypoint.
        </li>
        <li>
          <strong>No runtime dependencies.</strong> Node built-ins and web
          platform globals are enough.
        </li>
        <li>
          <strong>Edge runtimes.</strong> Not officially tested. The client uses
          standard fetch, AbortController, and crypto, but the server-only
          guard assumes a <code>window</code>-less environment. Use a Node.js
          runtime for now.
        </li>
      </ul>

      <p>
        Continue with <Link href="/errors">Errors</Link> for the failure
        surface.
      </p>
    </DocPage>
  )
}

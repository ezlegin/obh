import type { Metadata } from "next"
import Link from "next/link"

import { Callout } from "@/components/docs/callout"
import { CodeBlock } from "@/components/docs/code-block"
import { DocPage } from "@/components/docs/doc-page"
import { Endpoint } from "@/components/docs/content"
import { Step, Steps } from "@/components/docs/steps"
import { PropsTable, Table } from "@/components/docs/table"

export const metadata: Metadata = {
  title: "Gateways & installments",
  description:
    "List the gateways OBH offers, let customers choose one at checkout, and accept Digipay installment payments.",
}

const sections = [
  { id: "available-gateways", title: "Available gateways" },
  { id: "list-gateways", title: "List gateways" },
  { id: "checkout-picker", title: "Build a checkout picker" },
  { id: "digipay-installments", title: "Digipay installments" },
  { id: "simulator", title: "Testing with the simulator" },
  { id: "errors", title: "Errors" },
]

export default function GatewaysPage() {
  return (
    <DocPage
      href="/docs/gateways"
      eyebrow="Building"
      title="Gateways & installments"
      description={
        <>
          OBH offers more than one payment gateway. Call{" "}
          <code>listGateways()</code> to show them on your checkout page, then
          pass the customer&apos;s choice to <code>startPayment()</code>.
          Requires <code>@obhco/payments</code> 0.2.0.
        </>
      }
      sections={sections}
    >
      <h2 id="available-gateways">Available gateways</h2>
      <Table
        head={
          <>
            <th>Code</th>
            <th>Kind</th>
            <th>What the customer does</th>
          </>
        }
      >
        <tr>
          <td>
            <code>sadad</code>
          </td>
          <td>
            <code>card</code> (default)
          </td>
          <td>
            Pays the full amount with any Shetab bank card through Sadad (Bank
            Melli Iran).
          </td>
        </tr>
        <tr>
          <td>
            <code>zarinpal</code>
          </td>
          <td>
            <code>card</code>
          </td>
          <td>
            Pays the full amount with any Shetab bank card through Zarinpal.
            Minimum 10,000 R.
          </td>
        </tr>
        <tr>
          <td>
            <code>mellat</code>
          </td>
          <td>
            <code>card</code>
          </td>
          <td>
            Pays the full amount with any Shetab bank card through Bank Mellat
            (Behpardakht).
          </td>
        </tr>
        <tr>
          <td>
            <code>digipay</code>
          </td>
          <td>
            <code>installment</code>
          </td>
          <td>
            Buys now and pays later in installments with Digipay credit (BNPL),
            or pays with a Digipay wallet or card. Requires the customer&apos;s
            mobile number.
          </td>
        </tr>
      </Table>

      <Callout variant="tip" title="Do not hard-code this list">
        <p>
          OBH lists only the gateways that are currently enabled. A gateway
          without LIVE credentials disappears from the live list, and new
          gateways appear without an SDK change.
        </p>
      </Callout>

      <h2 id="list-gateways">List gateways</h2>
      <CodeBlock
        language="ts"
        code={`class OBHPayments {
  listGateways(options?: { simulator?: boolean }): Promise<PaymentGateway[]>
}`}
      />
      <Endpoint method="GET" path="/api/v1/gateways?simulator=false" />

      <PropsTable
        rows={[
          {
            name: "code",
            type: '"sadad" | "zarinpal" | "mellat" | "digipay" | string',
            required: true,
            description: "Pass this to startPayment as gateway.",
          },
          {
            name: "displayName",
            type: "string",
            required: true,
            description:
              "Persian label ready for a checkout page, e.g. خرید اقساطی با دیجی‌پی.",
          },
          {
            name: "kind",
            type: '"card" | "installment"',
            required: true,
            description: "Use it to group or label options.",
          },
          {
            name: "requiresCustomerMobile",
            type: "boolean",
            required: true,
            description:
              "When true, collect the customer's mobile number and pass customerMobile.",
          },
          {
            name: "isDefault",
            type: "boolean",
            required: true,
            description: "The gateway used when you omit gateway.",
          },
          {
            name: "minAmount",
            type: "string | null",
            required: true,
            description:
              "Minimum whole Rial amount, or null when there is none.",
          },
        ]}
      />

      <CodeBlock
        filename="Response"
        language="json"
        code={`{
  "data": [
    {
      "code": "sadad",
      "name": "Sadad (Bank Melli Iran)",
      "displayName": "پرداخت با کارت بانکی (سداد)",
      "kind": "card",
      "requiresCustomerMobile": false,
      "minAmount": null,
      "isDefault": true,
      "environment": "live"
    },
    {
      "code": "zarinpal",
      "name": "Zarinpal",
      "displayName": "پرداخت با زرین‌پال",
      "kind": "card",
      "requiresCustomerMobile": false,
      "minAmount": "10000",
      "isDefault": false,
      "environment": "live"
    },
    {
      "code": "mellat",
      "name": "Mellat (Behpardakht)",
      "displayName": "پرداخت با کارت بانکی (به‌پرداخت ملت)",
      "kind": "card",
      "requiresCustomerMobile": false,
      "minAmount": null,
      "isDefault": false,
      "environment": "live"
    },
    {
      "code": "digipay",
      "name": "Digipay (Installments / BNPL)",
      "displayName": "خرید اقساطی با دیجی‌پی",
      "kind": "installment",
      "requiresCustomerMobile": true,
      "minAmount": null,
      "isDefault": false,
      "environment": "live"
    }
  ]
}`}
      />

      <h2 id="checkout-picker">Build a checkout picker</h2>
      <Steps>
        <Step number={1} title="Load the gateways on your server">
          <CodeBlock
            language="ts"
            code={`const gateways = await obh.listGateways()`}
          />
        </Step>
        <Step number={2} title="Let the customer choose">
          <p>
            Render one option per gateway using <code>displayName</code>. If the
            chosen gateway has <code>requiresCustomerMobile</code>, ask for the
            customer&apos;s mobile number.
          </p>
        </Step>
        <Step number={3} title="Start the payment with that gateway">
          <CodeBlock
            filename="app/actions/checkout.ts"
            language="ts"
            code={`"use server"

import { redirect } from "next/navigation"

import { obh } from "@/lib/obh"

export async function checkout(form: FormData) {
  const gateways = await obh.listGateways()
  const chosen = gateways.find((g) => g.code === form.get("gateway"))
  if (!chosen) throw new Error("Unknown gateway")

  const payment = await obh.startPayment({
    externalOrderId: String(form.get("orderId")),
    amount: "15000000",
    description: "Pro subscription (yearly)",
    gateway: chosen.code,
    customerMobile: chosen.requiresCustomerMobile
      ? String(form.get("mobile"))
      : undefined,
    idempotencyKey: \`order-\${form.get("orderId")}-\${chosen.code}\`,
  })

  redirect(payment.checkoutUrl!)
}`}
          />
        </Step>
        <Step number={4} title="Verify the return the same way as always">
          <p>
            <code>verifyReturn()</code> and <code>getPayment()</code> work for
            every gateway. Trust only <code>payment.status</code>.{" "}
            <code>payment.gateway</code> tells you which gateway processed the
            payment.
          </p>
        </Step>
      </Steps>

      <Callout variant="warning" title="A new gateway is a new request">
        <p>
          The gateway and mobile number are part of the idempotency fingerprint.
          If the customer switches gateway, use a new idempotency key (for
          example, include the gateway code). Reusing the old key returns{" "}
          <code>409 IDEMPOTENCY_CONFLICT</code>.
        </p>
      </Callout>

      <h2 id="digipay-installments">Digipay installments</h2>
      <p>
        With Digipay the customer pays the first installment at checkout and the
        rest later. For your service nothing changes: once Digipay verifies the
        purchase, the payment is <code>completed</code> for the{" "}
        <strong>full amount</strong>, and you can fulfil the order immediately.
        Digipay owes the remaining installments to OBH, not your customer to
        you.
      </p>
      <ul>
        <li>
          <code>customerMobile</code> is required. <code>09…</code>,{" "}
          <code>+989…</code> and <code>989…</code> forms are accepted.
        </li>
        <li>
          Receipt fields map to Digipay values: <code>referenceNumber</code> is
          the Digipay <code>trackingCode</code> and <code>orderNumber</code> is
          the <code>providerId</code>.
        </li>
        <li>
          A customer may also choose a Digipay wallet or card on Digipay&apos;s
          page. Those are full payments, but the result looks the same to you.
        </li>
      </ul>

      <h2 id="simulator">Testing with the simulator</h2>
      <p>
        With <code>simulator: true</code>, <code>listGateways()</code> returns
        every gateway, and Digipay payments open the OBH Digipay simulator at{" "}
        <code>/pay/digipay/&lt;ticket&gt;</code>. There you can simulate a BNPL,
        credit, wallet or card purchase, or a failure. Zarinpal payments open{" "}
        <code>/pay/zarinpal/&lt;authority&gt;</code> and Mellat payments open{" "}
        <code>/pay/mellat/&lt;refId&gt;</code>.
      </p>

      <h2 id="errors">Errors</h2>
      <Table
        head={
          <>
            <th>Code</th>
            <th>Meaning</th>
          </>
        }
      >
        <tr>
          <td>
            <code>INVALID_ARGUMENT</code>
          </td>
          <td>
            The SDK rejected a malformed <code>gateway</code> or{" "}
            <code>customerMobile</code> before calling the API.
          </td>
        </tr>
        <tr>
          <td>
            <code>GATEWAY_NOT_SUPPORTED</code>
          </td>
          <td>422 — the gateway code is not one OBH offers.</td>
        </tr>
        <tr>
          <td>
            <code>CUSTOMER_MOBILE_REQUIRED</code>
          </td>
          <td>422 — the gateway needs the customer&apos;s mobile number.</td>
        </tr>
        <tr>
          <td>
            <code>GATEWAY_NOT_AVAILABLE</code>
          </td>
          <td>
            503 — the gateway is not enabled for LIVE payments. Offer another
            one from <code>listGateways()</code>.
          </td>
        </tr>
      </Table>
      <p>
        Everything else behaves as described in{" "}
        <Link href="/docs/payments/create">Create a payment</Link> and{" "}
        <Link href="/docs/errors">Errors</Link>.
      </p>
    </DocPage>
  )
}

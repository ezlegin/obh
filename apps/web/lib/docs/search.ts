export type SearchEntry = {
  page: string
  pageHref: string
  title: string
  hash?: string
  description: string
  keywords: string
}

export const searchIndex: SearchEntry[] = [
  {
    page: "Gateways & installments",
    pageHref: "/docs/gateways",
    title: "List available gateways",
    hash: "list-gateways",
    description:
      "Call listGateways() to show OBH's gateways on your checkout page.",
    keywords: "listGateways gateways checkout picker sadad digipay choose",
  },
  {
    page: "Gateways & installments",
    pageHref: "/docs/gateways",
    title: "Pay in installments with Digipay",
    hash: "digipay-installments",
    description:
      "Start a Digipay BNPL payment with gateway and customerMobile.",
    keywords: "digipay installment bnpl credit aghsati customerMobile mobile",
  },
  {
    page: "Introduction",
    pageHref: "/docs/docs",
    title: "What is @obhco/payments?",
    hash: "what-is-this",
    description:
      "A server-side TypeScript SDK for creating and reading OBH payments.",
    keywords: "sdk overview node typescript server payments",
  },
  {
    page: "Introduction",
    pageHref: "/docs/docs",
    title: "The one rule: the server decides",
    hash: "the-one-rule",
    description:
      "Only a server-side provider verification can mark a payment completed.",
    keywords: "redirect return url trust verification completed",
  },
  {
    page: "Quickstart",
    pageHref: "/docs/quickstart",
    title: "Install the SDK",
    hash: "install",
    description: "Add @obhco/payments to a Node.js or Next.js server project.",
    keywords: "install pnpm npm workspace dependency",
  },
  {
    page: "Quickstart",
    pageHref: "/docs/quickstart",
    title: "Create your first payment",
    hash: "create-your-first-payment",
    description: "Call startPayment, redirect to checkout, then verify status.",
    keywords: "startPayment checkout redirect first payment",
  },
  {
    page: "Quickstart",
    pageHref: "/docs/quickstart",
    title: "Read the result",
    hash: "read-the-result",
    description: "Fetch the authoritative payment status from your server.",
    keywords: "getPayment status completed pending",
  },
  {
    page: "How payments work",
    pageHref: "/docs/concepts",
    title: "The cast of a payment",
    hash: "the-cast",
    description:
      "Customer, your server, the OBH API, the provider, and webhooks.",
    keywords: "architecture diagram flow service provider",
  },
  {
    page: "How payments work",
    pageHref: "/docs/concepts",
    title: "Payment statuses",
    hash: "payment-statuses",
    description:
      "pending, completed, failed, cancelled, and expired explained.",
    keywords: "status lifecycle pending completed failed cancelled expired",
  },
  {
    page: "How payments work",
    pageHref: "/docs/concepts",
    title: "Money and environments",
    hash: "money-and-environments",
    description: "IRR decimal strings and the TEST/LIVE separation of records.",
    keywords: "amount currency IRR test live environment strings",
  },
  {
    page: "Create a payment",
    pageHref: "/docs/payments/create",
    title: "startPayment inputs",
    hash: "inputs",
    description:
      "Every field, which ones are required, and the validation applied.",
    keywords: "externalOrderId amount description returnUrl metadata",
  },
  {
    page: "Create a payment",
    pageHref: "/docs/payments/create",
    title: "Validation rules",
    hash: "validation-rules",
    description:
      "Amounts, order ids, descriptions, metadata, and idempotency keys.",
    keywords: "validation amount limit 191 500 metadata 8kb",
  },
  {
    page: "Create a payment",
    pageHref: "/docs/payments/create",
    title: "What you get back",
    hash: "what-you-get-back",
    description: "The Payment object returned by a successful creation.",
    keywords: "payment object checkoutUrl reference id",
  },
  {
    page: "Check status",
    pageHref: "/docs/payments/retrieve",
    title: "Retrieve one payment",
    hash: "retrieve-one-payment",
    description: "getPayment takes a reference and returns its current state.",
    keywords: "getPayment reference retrieve 404",
  },
  {
    page: "Check status",
    pageHref: "/docs/payments/retrieve",
    title: "Polling with backoff",
    hash: "polling",
    description: "Wait for a pending payment without hammering the API.",
    keywords: "poll retry backoff pending wait",
  },
  {
    page: "Idempotency & retries",
    pageHref: "/docs/idempotency",
    title: "How idempotency keys work",
    hash: "how-it-works",
    description:
      "The same key with the same request returns the original payment.",
    keywords: "idempotency key retry conflict duplicate",
  },
  {
    page: "Idempotency & retries",
    pageHref: "/docs/idempotency",
    title: "Choosing a key",
    hash: "choosing-a-key",
    description:
      "Derive a stable key from the order and attempt, then persist it.",
    keywords: "key naming order attempt persist database",
  },
  {
    page: "Webhooks",
    pageHref: "/docs/webhooks",
    title: "Verify a webhook signature",
    hash: "verify-a-signature",
    description:
      "HMAC-SHA256 over timestamp and raw body, with a timing-safe compare.",
    keywords: "webhook signature hmac OBH-Signature timestamp dedupe",
  },
  {
    page: "Configuration",
    pageHref: "/docs/configuration",
    title: "Client options",
    hash: "client-options",
    description:
      "secretKey, baseUrl, timeoutMs, and a custom fetch implementation.",
    keywords: "constructor options secretKey baseUrl timeoutMs fetch",
  },
  {
    page: "Configuration",
    pageHref: "/docs/configuration",
    title: "Base URL rules",
    hash: "base-url-rules",
    description:
      "HTTPS only, localhost exception, and automatic /api/v1 suffixing.",
    keywords: "base url https localhost api v1 origin",
  },
  {
    page: "Errors",
    pageHref: "/docs/errors",
    title: "OBHPaymentsError fields",
    hash: "error-fields",
    description:
      "code, status, requestId, details, retryable, and the original cause.",
    keywords: "error fields code status requestId retryable",
  },
  {
    page: "Errors",
    pageHref: "/docs/errors",
    title: "API error codes",
    hash: "api-error-codes",
    description:
      "Authentication, validation, conflicts, provider, and rate-limit codes.",
    keywords: "AUTH_INVALID ORDER_CONFLICT VALIDATION_ERROR PROVIDER_ERROR",
  },
  {
    page: "Errors",
    pageHref: "/docs/errors",
    title: "Handling errors",
    hash: "handling-errors",
    description:
      "Switch on codes, honour retryable, and surface request IDs to support.",
    keywords: "catch handler retry fallback support",
  },
  {
    page: "API reference",
    pageHref: "/docs/api-reference",
    title: "HTTP API",
    hash: "http-api",
    description: "POST /api/v1/payments and GET /api/v1/payments/{reference}.",
    keywords: "http api endpoint rest curl authorization",
  },
  {
    page: "API reference",
    pageHref: "/docs/api-reference",
    title: "TypeScript types",
    hash: "typescript-types",
    description: "Payment, StartPaymentInput, options, and the error envelope.",
    keywords: "types Payment StartPaymentInput PaymentStatus",
  },
  {
    page: "Next.js integration",
    pageHref: "/docs/guides/nextjs",
    title: "A complete Next.js flow",
    hash: "complete-flow",
    description:
      "Create, redirect, return, and reconcile with App Router route handlers.",
    keywords: "nextjs app router route handler server action",
  },
  {
    page: "Security",
    pageHref: "/docs/security",
    title: "Your responsibilities",
    hash: "your-responsibilities",
    description:
      "Keep secrets server-side, verify webhooks, and never trust redirects.",
    keywords: "security secrets threats logging rotation",
  },
  {
    page: "Troubleshooting",
    pageHref: "/docs/troubleshooting",
    title: "Common errors",
    hash: "common-errors",
    description:
      "Symptom, cause, and fix for the errors you are most likely to hit.",
    keywords: "troubleshooting fix error server-only https 401 409 timeout",
  },
]

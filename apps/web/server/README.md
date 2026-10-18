# Server-only application boundary

Code under `apps/web/server` and the server-side modules under `lib/auth` are
server-only. They must never be imported by a client component or exposed
through a shared package.

Organization:

```text
auth.ts                 Auth.js configuration and Credentials provider
proxy.ts                Optimistic JWT redirect for /admin/:path*
lib/auth/               Session guards, password hashing, redirect sanitization
lib/db/                 Prisma Client entry point
server/
  accounting/           Income, expenses, categories, recurring rules, documents
  api/                  Service auth, request parsing, API errors
  app-url.ts            Public checkout origin resolution
  equity/               Shareholders, ownership, profit periods, payouts
  errors.ts             Expected domain errors
  gateways/             Provider-account management foundation
  payments/             Payment lifecycle, API service, queries, adapters, webhooks
    providers/          Server-side provider adapter boundary
  reconciliation/       Provider fees, settlements, balances, reconciliation
  reports/              Financial queries, CSV exports, consistency checks
  services/             Connected-service registry and credential issuance
app/admin/*/            Guarded admin route handlers and server actions
app/api/v1/             Versioned service API route handlers
app/pay/dev/            Local development checkout page and completion route
```

Rules:

- Database access starts from `lib/db/client.ts` via `getDb()`. Do not construct
  another `PrismaClient` in application code.
- Protected pages use `requireAdmin()`. Every admin Server Action also calls it;
  the proxy is only an optimistic redirect.
- Service API route handlers use `authenticateServiceRequest()`. They never accept
  an admin browser session as service authentication.
- All payment queries in the service API are scoped by the authenticated service
  ID. Cross-service reads return 404.
- Server Components, Server Actions, and Route Handlers may call server
  services. Browser components and shared packages must not import `lib/db` or
  `lib/generated/prisma`.
- Multi-record financial changes use Prisma transactions in the service layer.
- All external input is validated on the server before it reaches a service.
- Use `Prisma.Decimal` for monetary and percentage values. Never use floating
  point for financial calculations.
- Provider credentials, service secret material, webhook signing secrets,
  expense-document binaries, and trusted payment verification stay server-side.
- Development-provider results are simulated and only valid for TEST payments.
  The development checkout is not proof of a real payment.
- Reports distinguish TEST from LIVE. TEST payments are excluded from financial
  totals and profit.
- `@workspace/ui` and `@obh/payments` remain independent of the application
  database.

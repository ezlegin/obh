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
  errors.ts             Expected domain errors
  gateways/             Provider-account management foundation
  payments/             Payment lifecycle, queries, credentials, adapters
    providers/          Server-side provider adapter boundary
  services/             Connected-service registry and credential issuance
```

Rules:

- Database access starts from `lib/db/client.ts` via `getDb()`. Do not construct
  another `PrismaClient` in application code.
- Protected pages use `requireAdmin()`. Every admin Server Action also calls it;
  the proxy is only an optimistic redirect.
- Server Components, Server Actions, and Route Handlers may call server
  services. Browser components and shared packages must not import `lib/db` or
  `lib/generated/prisma`.
- Multi-record financial changes use Prisma transactions in the service layer.
- All external input is validated on the server before it reaches a service.
- Use `Prisma.Decimal` for monetary values. Never use floating point for money.
- Provider credentials, service secret material, and trusted payment
  verification stay server-side. Provider adapters never expose secret values.
- Development-provider results are simulated and only valid for TEST payments.
- `@workspace/ui` and `@obh/payments` remain independent of the application
  database.

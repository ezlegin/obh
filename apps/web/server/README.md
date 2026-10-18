# Server-only application boundary

Code under `apps/web/server` and the server-side modules under `lib/auth` are
server-only. They must never be imported by a client component or exposed
through a shared package.

Organization:

```text
auth.ts            Auth.js configuration and Credentials provider
proxy.ts           Optimistic JWT redirect for /admin/:path*
lib/auth/          Session guards, password hashing, redirect sanitization
lib/db/            Prisma Client entry point
server/
  repositories/   Prisma queries and persistence; no UI concerns
  services/       Transactional business operations and invariants
  payments/       Provider adapters and trusted verification (later steps)
```

Rules:

- Database access starts from `lib/db/client.ts` via `getDb()`. Do not construct
  another `PrismaClient` in application code.
- Protected pages use `requireAdmin()`. Future admin Server Actions and Route
  Handlers must also call it; the proxy is only an optimistic redirect.
- Server Components, Server Actions, and Route Handlers may call server
  services. Browser components and shared packages must not import `lib/db` or
  `lib/generated/prisma`.
- Multi-record financial changes must use a Prisma transaction in the service
  layer.
- All external input is validated on the server before it reaches a service.
- Use `Prisma.Decimal` for monetary values. Never use floating point for money.
- Provider credentials, service secret material, and trusted payment
  verification stay server-side.
- `@workspace/ui` and `@obh/payments` remain independent of the application
  database.

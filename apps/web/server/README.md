# Server-only application boundary

Code under `apps/web/server` is server-only. It must never be imported by a
client component or exposed through a shared package.

Planned organization:

```text
server/
  repositories/   Prisma queries and persistence; no UI concerns
  services/       Transactional business operations and invariants
  payments/       Provider adapters and trusted verification (later steps)
  auth/           Auth.js configuration and session helpers (Step 3)
```

Rules:

- Database access starts from `lib/db/client.ts`. Do not construct another
  `PrismaClient` in application code.
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

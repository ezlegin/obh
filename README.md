# OBH

OBH is an IT corporation building a centralized financial platform for its
portfolio of digital services. This repository contains the public OBH website
and the foundation for the administrative/financial platform, the payment API,
and the reusable payment SDK.

## Stack

- pnpm workspace + Turborepo
- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS v4 and shadcn/ui primitives
- Inter via `next/font/google`, dark mode only
- PostgreSQL with Prisma ORM 7.10.1 and the `@prisma/adapter-pg` driver adapter
- Auth.js v5 is planned for Step 3 and is not configured yet

## Workspace

```text
apps/
  web/                 Next.js public site and (later) admin/payment API
  docs/                Reserved for the standalone SDK documentation app
packages/
  payments/            Reserved @obh/payments SDK scaffold (no implementation)
  ui/                  Shared shadcn/ui primitives and design tokens
  eslint-config/       Shared ESLint configuration
  typescript-config/   Shared TypeScript configuration
```

The documentation application must remain separate from `apps/web`. The
`@obh/payments` package name is provisional until the SDK architecture is
approved.

## Local development

Requirements: Node.js 22.13+ and pnpm 11.

```bash
pnpm install
pnpm dev:web
```

The public site runs at [http://localhost:3100](http://localhost:3100). Port
3000 is intentionally not used by default so this workspace does not collide
with unrelated projects.

Other useful commands:

```bash
pnpm dev           # Turborepo dev task for all configured apps
pnpm build         # Prisma generate + production build
pnpm lint          # ESLint for every workspace package
pnpm typecheck     # strict TypeScript checks
pnpm db:validate   # validate the Prisma schema
pnpm db:generate   # generate the Prisma 7 client
pnpm db:migrate    # create/apply a development migration
pnpm db:deploy     # apply committed migrations (deployment)
pnpm db:studio     # open Prisma Studio
```

The public site does not require a database connection. Database commands need
`DATABASE_URL`. To configure a local database:

```bash
copy apps\web\.env.example apps\web\.env
```

Then replace the placeholder credentials in `apps/web/.env` with a dedicated
local PostgreSQL database and least-privileged user. Never commit `.env`.

Inter is loaded through `next/font/google`. A production build therefore
requires network access to Google Fonts; the font is not vendored in this
repository.

## Database foundation

The Prisma 7 schema and initial migration are implemented under
[`apps/web/prisma`](apps/web/prisma). Architecture decisions, monetary rules,
entity relationships, deletion behavior, and unresolved business rules are
documented in [`apps/web/prisma/README.md`](apps/web/prisma/README.md).

Database access is server-only. The single Prisma Client entry point is
[`apps/web/lib/db/client.ts`](apps/web/lib/db/client.ts), and the server layer
convention is described in [`apps/web/server/README.md`](apps/web/server/README.md).
Shared packages must remain independent of application database internals.

The initial migration was validated against a disposable PostgreSQL 18
instance. No persistent OBH database was provisioned with user credentials.

## Project status

Completed:

- Step 1 — project foundation and public visual direction
- Step 2 — database and application architecture foundation

Applied decisions:

- pnpm workspace with Turborepo task orchestration
- shared shadcn/ui primitives in `packages/ui`
- dark-only design system with Inter and fully rounded controls
- original OBH SVG wordmark used in the navbar, footer, and system map
- standalone documentation app boundary reserved in `apps/docs` (not built)
- provisional `@obh/payments` package boundary reserved (not implemented)
- Prisma 7 server-only database boundary with an initial financial schema and
  one validated initial migration

Awaiting confirmation before later steps:

- final `@obh/payments` package name and API architecture
- direct OBH contact channel (no email address or phone number was supplied)
- live status of the six external service destinations
- when the standalone documentation application should be implemented
- profit distribution rules, revenue recognition policy, reporting time zone,
  and the other database rules listed in `apps/web/prisma/README.md`

Admin, authentication, payment API/SDK, accounting calculations, shareholder
workflows, and reporting remain intentionally unimplemented.

## Public routes

- `/` — corporation introduction and service ecosystem
- `/about-us` — corporate overview
- `/contact-us` — service-based contact directory
- `/terms` — website terms
- `/docs` — not implemented; reserved for the separate documentation app

## Adding shadcn/ui components

The shared UI package contains the design system. From the repository root:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Components are generated in `packages/ui/src/components` and imported through
the package boundary:

```tsx
import { Button } from "@workspace/ui/components/button"
```

## Service links

The homepage and footer link to the six domains supplied in the project brief.
Those external destinations have not been verified as live in this environment.
The contact page does not invent an email address or phone number; it routes
visitors through the official service domains until an OBH contact channel is
confirmed.

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
- Auth.js v5 with email/password credentials, bcrypt, and JWT sessions

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
pnpm test          # payment lifecycle, adapter, credential tests
pnpm db:validate   # validate the Prisma schema
pnpm db:generate   # generate the Prisma 7 client
pnpm db:push       # push the schema directly to the database
pnpm db:studio     # open Prisma Studio
pnpm auth:create-manager # provision a manager (no public registration)
```

The public site does not require a database connection. Authentication and all
admin routes do. To configure a local environment:

```bash
copy apps\web\.env.example apps\web\.env
```

Then replace the placeholder PostgreSQL credentials and `AUTH_SECRET` in
`apps/web/.env`, push the schema with `pnpm db:push`, and create the manager:

```bash
pnpm auth:create-manager
```

The manager is prompted for a password and confirmation. Never commit `.env`
or `.env.local`. See [`apps/web/AUTH.md`](apps/web/AUTH.md) for the full
authentication and security notes.

After sign-in at [http://localhost:3100/login](http://localhost:3100/login), the
protected console is available at `/admin`.

Inter is loaded through `next/font/google`. A production build therefore
requires network access to Google Fonts; the font is not vendored in this
repository.

## Database foundation

The Prisma 7 schema is implemented under [`apps/web/prisma`](apps/web/prisma).
Architecture decisions, monetary rules, entity relationships, deletion behavior,
and unresolved business rules are documented in
[`apps/web/prisma/README.md`](apps/web/prisma/README.md). The schema is applied
with `prisma db push` rather than a migration history.

Database access is server-only. The single Prisma Client entry point is
[`apps/web/lib/db/client.ts`](apps/web/lib/db/client.ts), and the server layer
convention is described in [`apps/web/server/README.md`](apps/web/server/README.md).
Shared packages must remain independent of application database internals.

The schema was validated against a disposable PostgreSQL 18 instance. No
persistent production database was provisioned with user credentials.

## Authentication and admin

Auth.js v5 protects the entire `/admin` area. The implementation includes:

- `/login` with email/password validation and accessible error states
- bcrypt password hashing and generic invalid-credential errors
- a standalone manager-provisioning CLI
- an optimistic Next.js 16 proxy redirect that preserves safe callback URLs
- a database-backed `requireAdmin()` guard for every admin page
- responsive admin navigation and sign-out
- `noindex` admin metadata and no login links on the public website
- a reusable admin component set for summaries, tables, filters, dialogs,
  forms, charts, loading states, and empty states

The dashboard at `/admin` currently uses clearly labeled development data. No
figure there is read from or written to the database, and the interface states
this prominently. Real data will replace it when the relevant modules are
implemented.

No registration, password reset, MFA, or login rate limiting is implemented yet.
See [`apps/web/AUTH.md`](apps/web/AUTH.md).

## Payment platform foundation

The service-facing HTTP API and npm SDK are not implemented yet. Their reviewed
contract is documented in
[`apps/web/PAYMENT_API.md`](apps/web/PAYMENT_API.md).

Implemented in Step 5:

- connected-service registration with exact return URL allowlists and a default
  return URL
- one-time TEST credential issuance and revocation, with only hashed secrets
  stored
- a server-side provider adapter boundary
- an explicit local-only development adapter that supports TEST only
- development provider and TEST provider-account setup
- payment creation, provider session creation, lifecycle transitions, payment
  events, verification attempts, and audit records
- an admin TEST payment console that exercises success and failure paths
- duplicate external-order prevention
- unit tests for lifecycle transitions, credential hashing, and adapter behavior

All admin payment records currently created through the UI are marked `TEST`.
No real provider is contacted and no value moves. The API/SDK and webhook delivery
are intentionally deferred to Step 6.

## Project status

Completed:

- Step 1 — project foundation and public visual direction
- Step 2 — database and application architecture foundation
- Step 3 — authentication, login, protected admin layout, and route scaffolds
- Step 4 — interactive dashboard and shared admin components
- Step 5 — payment platform, provider boundary, services, and gateway foundation

Applied decisions:

- pnpm workspace with Turborepo task orchestration
- shared shadcn/ui primitives in `packages/ui`
- dark-only design system with Inter and fully rounded controls
- original OBH SVG wordmark used in the navbar, footer, and system map
- standalone documentation app boundary reserved in `apps/docs` (not built)
- provisional `@obh/payments` package boundary reserved (not implemented)
- Prisma 7 server-only database boundary with an initial financial schema
  applied through `prisma db push`
- Auth.js v5 JWT sessions, manager provisioning CLI, server-side admin guard,
  and responsive protected admin navigation
- reusable summary cards, data table, filter form, dialogs, chart, loading
  skeleton, and empty states in the protected admin area
- a dashboard clearly labeled as development data, with no sample figure
  presented as an actual financial record
- TEST/LIVE separation on credentials and payments, a development provider
  adapter, and a versioned API contract documented before SDK work

Awaiting confirmation before later steps:

- approval of the v1 payment API contract in `apps/web/PAYMENT_API.md`
- final `@obh/payments` package name and SDK architecture
- direct OBH contact channel (no email address or phone number was supplied)
- live status of the six external service destinations
- when the standalone documentation application should be implemented
- profit distribution rules, revenue recognition policy, reporting time zone,
  and the other database rules listed in `apps/web/prisma/README.md`

Business modules, accounting calculations, shareholder workflows, and reporting
remain intentionally unimplemented. The service API, npm SDK, webhook signing,
and delivery worker are deferred to Step 6. Login rate limiting is also deferred
to production hardening.

## Routes

Public:

- `/` — corporation introduction and service ecosystem
- `/about-us` — corporate overview
- `/contact-us` — service-based contact directory
- `/terms` — website terms
- `/login` — manager sign-in (not linked from the public website)
- `/docs` — not implemented; reserved for the separate documentation app

Protected:

- `/admin` — development-data financial dashboard
- `/admin/payments` — TEST payment console and lifecycle
- `/admin/gateways` — development provider and TEST account setup
- `/admin/services` — connected-service registry and credentials
- `/admin/expenses`, `/admin/income`, `/admin/reports`
- `/admin/shareholders`, `/admin/distributions`
- `/admin/settings`

All `/admin` routes require a valid manager session and an active database user.

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

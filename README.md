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
  payments/            Server-side @obhco/payments SDK
  ui/                  Shared shadcn/ui primitives and design tokens
  eslint-config/       Shared ESLint configuration
  typescript-config/   Shared TypeScript configuration
```

The documentation application must remain separate from `apps/web`. The
`@obhco/payments` package is published on npm at version `0.1.0`.

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
pnpm test          # payment/API/SDK unit tests
pnpm test:integration # local API + SDK integration test (requires local server)
pnpm webhooks:process # process due webhook retries
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

## Payment platform and SDK

The versioned API contract and security model are documented in
[`apps/web/PAYMENT_API.md`](apps/web/PAYMENT_API.md). The server-side SDK is
[`@obhco/payments`](packages/payments), version `0.1.0`, published on npm as
[`@obhco/payments`](https://www.npmjs.com/package/@obhco/payments).

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

Implemented in Step 6:

- `POST /api/v1/payments` and `GET /api/v1/payments/{reference}`
- Bearer service authentication, revocation, last-used tracking, and service
  isolation
- idempotency keys and canonical request fingerprints
- provider checkout URL generation and a local development checkout
- server-side development verification producing completed/failed records
- signed `payment.completed` / `payment.failed` webhooks with retries
- encrypted per-service webhook signing secrets and rotation in admin
- `@obhco/payments` with typed errors, timeouts, idempotency support, and a
  server-only guard
- local API/SDK integration tests covering cross-service isolation, idempotency,
  signed webhooks, retry delivery, and revoked credentials

Every payment created in this environment is TEST and uses the development
adapter. No real payment provider has been contacted, no real money has moved,
and the SDK has not been published or tested against a live provider. The
development adapter is disabled in production builds unless explicitly enabled in
an approved test environment; see
[`DEVELOPMENT_PAYMENTS.md`](apps/web/DEVELOPMENT_PAYMENTS.md).

## Accounting and expenses

Accounting boundaries, document rules, and recurring approvals are documented in
[`apps/web/ACCOUNTING.md`](apps/web/ACCOUNTING.md).

Implemented in Step 7:

- business-owned payment sources for bank, cash, and wallet accounts
- expense categories with configurable supporting-document requirements
- income records kept separate from payments and shareholder capital
- expense records with pending/paid states and payment-source assignment
- private PDF/image attachments with signature checks, checksums, guarded
  downloads, and a 10 MB limit
- server-enforced document requirements before an expense can be marked paid
- approval-gated recurring expense rules:
  - draft by default;
  - explicit manager approval records the approver and time;
  - pause, resume, and end states;
  - manual generation of due, pending expenses only;
  - no automatic charges or payments
- real accounting summaries and filtered views for expenses and income

Supporting documents currently use private local storage. Production must move
them to protected object storage. No real money moves through these workflows.

## Equity and profit distribution

The approved monthly profit rules, ownership snapshots, loss carryforward,
approval model, and full-payout policy are documented in
[`apps/web/EQUITY.md`](apps/web/EQUITY.md).

Implemented in Step 8:

- shareholder profiles and historical effective-date ownership records
- overlap protection and period-end 100.0000% ownership validation
- monthly cash-basis profit calculation using LIVE payments, manual income, paid
  expenses, settled LIVE provider fees, reserve, and tax
- loss carryforward and whole-IRR allocation with retained rounding residual
- period-level manager approval and frozen snapshots
- full payout per shareholder against a business payment source
- automatic period close after all positive allocations are paid
- audit history for ownership, calculation, approval, and payouts

TEST payments are excluded from profit. No payments, transfers, or bank
operations are executed by the distribution workflow.

## Reports and reconciliation

Reporting definitions, consistency checks, exports, and reconciliation math are
documented in [`apps/web/REPORTS.md`](apps/web/REPORTS.md).

Implemented in Step 9:

- date-filtered cash-basis financial reports
- revenue by service, expenses by category, and income by source
- approved distributable profit and payout summaries
- manager-only CSV exports for summary, LIVE payments, expenses, and
  distributions, with formula-injection protection
- provider fee tracking, settlement transfers, calculated provider balances, and
  reconciliation against actual statement balances
- consistency checks across payments, income, expenses, documents, profit
  periods, distributions, payouts, and provider reconciliations
- TEST payments excluded from financial totals and surfaced as a review item

## Production readiness

Deployment, environment, backup, worker scheduling, document storage, security,
and SDK release procedures are documented in
[`DEPLOYMENT.md`](DEPLOYMENT.md) and
[`packages/payments/RELEASING.md`](packages/payments/RELEASING.md).

Step 10 verified:

- production build and all workspace tests
- route-by-route desktop and mobile rendering with no horizontal overflow
- one `h1` and one main landmark per admin route
- accessible names for buttons and form controls
- no duplicate DOM IDs in the audited routes
- security headers and error boundaries
- no client-exposed secrets or unsafe HTML injection
- CSV formula-injection protection
- SDK tarball contents and release/versioning documentation

No deployment, npm publication, or production payment operation was performed.

## Project status

Completed:

- Step 1 — project foundation and public visual direction
- Step 2 — database and application architecture foundation
- Step 3 — authentication, login, protected admin layout, and route scaffolds
- Step 4 — interactive dashboard and shared admin components
- Step 5 — payment platform, provider boundary, services, and gateway foundation
- Step 6 — versioned payment API, signed notifications, and `@obhco/payments` SDK
- Step 7 — income, expenses, categories, payment sources, recurring rules, and documents
- Step 8 — shareholders, ownership history, monthly distributions, and payouts
- Step 9 — financial reports, CSV exports, reconciliation, and consistency checks
- Step 10 — final review, hardening, tests, and deployment documentation

Applied decisions:

- pnpm workspace with Turborepo task orchestration
- shared shadcn/ui primitives in `packages/ui`
- dark-only design system with Inter and fully rounded controls
- original OBH SVG wordmark used in the navbar, footer, and system map
- standalone documentation app boundary reserved in `apps/docs` (not built)
- published `@obhco/payments` 0.1.0 package, built, pack-checked, and available on
  npm
- Prisma 7 server-only database boundary with an initial financial schema
  applied through `prisma db push`
- Auth.js v5 JWT sessions, manager provisioning CLI, server-side admin guard,
  and responsive protected admin navigation
- reusable summary cards, data table, filter form, dialogs, chart, loading
  skeleton, and empty states in the protected admin area
- a dashboard clearly labeled as development data, with no sample figure
  presented as an actual financial record
- TEST/LIVE separation on credentials and payments, a development provider
  adapter, and a versioned API contract
- authenticated service API, idempotent payment initiation, scoped retrieval,
  development checkout, signed webhooks, retry worker, and SDK integration tests
- business payment sources, expense categories, income and expense ledgers,
  private document attachments, and approval-gated recurring expense rules
- historical ownership, monthly profit snapshots, loss carryforward,
  single-manager approval, and full shareholder payouts
- date-filtered cash-basis reports, CSV exports, provider settlements, gateway
  reconciliation, and cross-ledger consistency checks
- production security headers, error boundaries, responsive audit, and deployment
  and SDK release documentation

Awaiting confirmation before later steps:

- review and approval of Steps 8–10
- review and approval of Step 6 before npm publication
- authorized test against a real payment provider before any live integration
  claim
- production object-storage provider and malware-scanning decision for documents
- formal tax/withholding and external reporting policy
- direct OBH contact channel (no email address or phone number was supplied)
- live status of the six external service destinations
- when the standalone documentation application should be implemented
- remaining production controls such as MFA, login/API rate limiting, and
  distributed webhook worker scheduling

Formal tax/withholding calculations and externally audited reporting remain
outside this implementation. The dashboard is still development data. Login/API
rate limiting, MFA, webhook worker scheduling, automated statement import, and
document scanning are production gaps documented in `DEPLOYMENT.md`.

## Routes

Public:

- `/` — corporation introduction and service ecosystem
- `/about-us` — corporate overview
- `/contact-us` — service-based contact directory
- `/terms` — website terms
- `/login` — manager sign-in (not linked from the public website)
- `/pay/dev/<session>` — noindex development checkout (TEST only)
- `/docs` — not implemented; reserved for the separate documentation app

API:

- `POST /api/v1/payments` — service-authenticated payment initiation
- `GET /api/v1/payments/{reference}` — service-scoped payment retrieval

Protected:

- `/admin` — development-data financial dashboard
- `/admin/payments` — TEST payment console and lifecycle
- `/admin/gateways` — development provider and TEST account setup
- `/admin/services` — connected-service registry and credentials
- `/admin/reconciliation` — provider fees, settlements, balances, and reconciliation
- `/admin/accounts` — business payment sources
- `/admin/expenses` — expenses, categories, documents, and recurring rules
- `/admin/income` — additional income records
- `/admin/reports` — filtered financial reports, checks, and CSV exports
- `/admin/shareholders` — profiles and ownership history
- `/admin/distributions` — monthly profit periods, approvals, and payouts
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

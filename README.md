# OBH

OBH is an IT corporation building a centralized financial platform for its
portfolio of digital services. This repository contains the public OBH website
and the foundation for the administrative/financial platform, the payment API,
and the reusable payment SDK.

## Stack

- pnpm workspace + Turborepo
- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS v4 and shadcn/ui primitives
- Inter, dark mode only
- PostgreSQL, Prisma, and Auth.js are planned for later authorized steps; they
  are not installed or configured yet

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
pnpm dev          # Turborepo dev task for all configured apps
pnpm build        # production build through Turborepo
pnpm lint         # ESLint for every workspace package
pnpm typecheck    # strict TypeScript checks
```

No environment variables are required for the Step 1 public website.

Inter is loaded through `next/font/google`. A production build therefore
requires network access to Google Fonts; the font is not vendored in this
repository.

## Project status

Completed: Step 1 — project foundation and public visual direction.

Applied decisions:

- pnpm workspace with Turborepo task orchestration
- shared shadcn/ui primitives in `packages/ui`
- dark-only design system with Inter and fully rounded controls
- original OBH SVG wordmark used in the navbar, footer, and system map
- standalone documentation app boundary reserved in `apps/docs` (not built)
- provisional `@obh/payments` package boundary reserved (not implemented)

Awaiting confirmation before later steps:

- final `@obh/payments` package name and API architecture
- direct OBH contact channel (no email address or phone number was supplied)
- live status of the six external service destinations
- when the standalone documentation application should be implemented

Admin, authentication, database, payment API/SDK, accounting, shareholder, and
reporting functionality remain intentionally unimplemented.

## Public routes

- `/` — corporation introduction and service ecosystem
- `/about-us` — corporate overview
- `/contact-us` — service-based contact directory
- `/terms` — website terms
- `/docs` — not implemented; reserved for the separate documentation app

Admin, authentication, database, payment, accounting, shareholder, reporting,
and SDK functionality are intentionally out of scope for Step 1.

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

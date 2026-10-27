# OBH Payments SDK documentation

A standalone Next.js application that documents
[`@obhco/payments`](../../packages/payments) — the server-side TypeScript SDK for
the versioned OBH payment API.

This app is intentionally independent of `apps/web`. It has no database, no
authentication, and no API access; every page is static documentation.

## Run it

```bash
pnpm --filter docs dev     # http://localhost:3200
pnpm --filter docs build
pnpm --filter docs start
pnpm --filter docs lint
pnpm --filter docs typecheck
```

From the repository root, `pnpm dev:docs` is a shortcut for the dev server.

## What is inside

- `app/` — App Router pages and the root layout.
- `components/` — documentation shell (header, sidebar, search, TOC), code
  blocks with a dependency-free highlighter, callouts, tables, and diagrams.
- `lib/navigation.ts` — the sidebar structure and previous/next ordering.
- `lib/search.ts` — the static search index used by the ⌘K dialog.
- `lib/highlight.ts` — the small tokenizer behind highlighted code blocks.

The content is written for a reader who has never integrated a payment
provider. It documents the SDK as it exists at version `0.1.0`:

- TEST-only, published on npm as `@obhco/payments@0.1.0`, not production-ready.
- No real provider or live payment has been tested.
- Webhook signing is the integrating service's responsibility.

Update the content here whenever the package contract changes.

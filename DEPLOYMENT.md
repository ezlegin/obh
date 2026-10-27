# OBH deployment and operations

Status: **no production deployment has been performed.** This document describes
the required setup, controls, and known gaps for review.

## Runtime requirements

- Node.js 22.13 or newer (the repository declares `>=22.13.0`).
- pnpm `11.25.0`.
- PostgreSQL 18 is the tested database; Prisma supports the configured
  PostgreSQL provider.
- HTTPS at the reverse proxy.
- Persistent private storage for expense documents, or an object-storage
  replacement.

## Environment

Set these in the hosting environment, never in Git:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js session signing and webhook-secret encryption key |
| `APP_URL` | Yes outside localhost | Public origin used for development checkout URLs |
| `NODE_ENV` | Yes | `production` for deployed builds |
| `OBH_ENABLE_DEVELOPMENT_PROVIDER` | No | Set `true` only in an approved TEST environment |
| `EXPENSE_DOCUMENT_DIR` | Recommended | Private directory for uploaded expense documents |
| `AUTH_URL` | Optional | Auth.js canonical URL when the proxy/host inference is insufficient |

Generate `AUTH_SECRET` with 32 random bytes, for example:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`AUTH_SECRET` also derives the AES-256-GCM key that protects webhook signing
secrets. Rotating it without rotating those service secrets makes existing
webhook secrets unreadable.

See [`apps/web/.env.example`](apps/web/.env.example).

## First setup

```bash
pnpm install
pnpm db:ensure      # create the database named in DATABASE_URL if it is missing
pnpm db:generate
pnpm db:push
pnpm auth:create-manager
```

To provision or reset the manager from `ADMIN_EMAIL` and `ADMIN_PASSWORD`
(for example, values stored in `apps/web/.env.local`), use:

```bash
pnpm auth:reset-manager
```

This project intentionally uses `prisma db push` rather than a migration history.
For production, take a verified database backup before every schema push. Do not
run `db push` against production without a reviewed schema diff and rollback
plan.

## Build and start

```bash
pnpm build
pnpm --filter web start
```

The build runs `prisma generate` and Next.js. The default application port should
be placed behind a TLS reverse proxy. Do not expose the Next.js development
server publicly.

Next.js sets baseline security headers from `next.config.ts`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- strict referrer policy
- restrictive permissions policy
- cross-origin opener policy
- HSTS in production builds

The proxy should add request-size limits and rate limits for `/login` and
`/api/v1/*`. Application-level login/API rate limiting is not implemented yet.

## Background worker

Webhook delivery attempts happen immediately and pending retries remain in the
database. Schedule:

```bash
pnpm webhooks:process
```

every minute from cron, a platform scheduler, or a managed worker. Run only one
worker at a time unless delivery claiming is added to prevent duplicate attempts.

Recommended crontab entry:

```cron
* * * * * cd /srv/obh && pnpm webhooks:process >> /var/log/obh-webhooks.log 2>&1
```

## Private document storage

Local development stores expense documents under
`apps/web/storage/expense-documents`. That directory is gitignored and is not
publicly served.

Production requirements:

- use private object storage, or a persistent volume with restricted permissions;
- encrypt at rest and in transit;
- back up files and database metadata together;
- preserve the relationship between `ExpenseDocument.storageKey` and the stored
  object;
- never expose the directory through a static web server;
- add malware/content scanning before accepting uploads from untrusted users;
- define retention and deletion policy.

The current local filesystem adapter is not a complete production document
service.

## Database operations

- Back up PostgreSQL before schema pushes and regularly thereafter.
- Test restore procedures, not only backups.
- Financial records are restrictively deleted; no cascade deletion is expected.
- Never edit production payment, expense, distribution, or payout rows directly.
- Use the application audit trail for financial changes.
- Preserve a read-only copy of approved monthly profit snapshots.

## Provider and payment safety

- LIVE provider credentials belong in a secret manager/env, never in the
  database or browser.
- The development adapter is disabled in production unless explicitly enabled.
- TEST payments are excluded from reports and profit calculations.
- No live provider integration has been tested. Do not advertise real payment
  processing until an authorized provider certification is completed.
- Webhook destinations are admin-controlled. Production should add egress
  controls/SSRF restrictions for webhook URLs.

## SDK release process

`@obhco/payments` is version `0.1.0` and is published on npm as
`@obhco/payments`.

1. Review API/contract compatibility and update `CHANGELOG.md`.
2. Bump the package version using semver.
3. Run package and repository checks.
4. Build and inspect the tarball.
5. Obtain explicit approval.
6. Publish only with organization npm access.

See [`packages/payments/RELEASING.md`](packages/payments/RELEASING.md).

## Security checklist

- HTTPS and HSTS at the public edge.
- Strong unique `AUTH_SECRET`; rotate with a webhook-secret rotation plan.
- Restrict database access to the application network.
- Keep `.env*` out of Git; `.env.local` is ignored.
- Rate limit login and API traffic at the proxy or add a distributed limiter.
- Restrict admin access at the network layer where practical.
- Back up the database and document store; test restores.
- Run the webhook worker on a schedule.
- Monitor failed webhook deliveries, provider reconciliation differences, and
  consistency-check failures.
- Keep the development provider disabled in production.
- Review npm package access and license/legal status before publication.
- Add CSP at the edge only after validating Next.js inline assets.
- Add MFA and password-reset/session-revocation workflows before broader rollout.

## Known production gaps

- No login/API rate limiting in the application.
- No MFA or self-service password reset.
- No antivirus scanning or object-storage adapter for documents.
- No automatic provider statement import.
- No automatic webhook worker scheduling in this repository.
- No live payment provider certification.
- No formal revenue-recognition/tax policy.
- Reports load the selected range in memory and are not paginated/streamed.
- The admin dashboard still uses clearly labeled development data.
- No container image, cloud IaC, or deployment pipeline is included.
- No production backup/restore run has been performed in this environment.

## Rollback

1. Stop the web process and webhook worker.
2. Restore the previous application build.
3. Restore the matching database backup if a schema change is involved.
4. Restore document storage to the matching snapshot.
5. Re-run smoke checks: `/login`, `/admin`, reports, document download, API auth.
6. Record the incident and affected financial periods.

No deployment or production payment operation should be performed without
separate authorization.

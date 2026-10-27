# Deploying OBH to obhco.ir

Production runs on the shared VPS `91.107.179.58` (Ubuntu 24.04) in `/opt/obh`.
Images are **built on GitHub Actions** and pulled from GHCR; the server never
builds Next.js. The public surface is a single origin, `https://obhco.ir`:

| Route | Served by |
| --- | --- |
| `/` and the admin/API routes | `obh-web` (Next.js `apps/web`, port 3000) |
| `/docs` (SDK documentation) | `obh-docs` (Next.js `apps/docs`, port 3200, `basePath: "/docs"`), reached through the web app's rewrite to `http://docs:3200/docs` |
| TLS / host routing | the existing `nginx-proxy` + Let's Encrypt companion containers |

The docs app has no host port. Only `obh-web` joins the proxy's external
`app_network` and declares `VIRTUAL_HOST`/`LETSENCRYPT_HOST`, so the shared
proxy is untouched and no second domain/certificate is needed.

## DNS

`obhco.ir` is delegated to ArvanCloud. Set:

```
obhco.ir.  A  91.107.179.58
```

Use **DNS-only** (no ArvanCloud proxy / grey cloud). The Let's Encrypt
companion issues the certificate over the HTTP-01 challenge on port 80; an
intercepting CDN proxy prevents that. No `www` record is needed.

Certificate attempts are controlled by `LETSENCRYPT_HOST` in `.env`. Leave it
**empty** while the record does not resolve: the companion otherwise retries
against the rate limit every minute. Once DNS answers, set
`LETSENCRYPT_HOST=obhco.ir` and run `docker compose up -d web`; the certificate
is usually issued within a minute (after any rate-limit cooldown).

## GitHub configuration

Repository secrets (`Settings → Secrets and variables → Actions`):

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_KEY` | private key of the server's `obh-deploy` user |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 91.107.179.58` output |

The repository's `GITHUB_TOKEN` pushes the image to
`ghcr.io/ezlegin/obh`; no extra registry secret is required.

Workflows:

- `.github/workflows/deploy-image.yml` — on every push to `master`, builds the
  single image (web + docs) and pushes `:latest` and `:<commit sha>`.
- `.github/workflows/deploy.yml` — after a successful build, SSHes to the server
  as `obh-deploy` (forced command, sudo only for `deploy.sh`), applies the schema
  and restarts the apps. Run it manually with a commit sha to roll back.

## Server layout

```
/opt/obh/
  compose.yml               stack definition
  deploy.sh                 pull image, push schema, restart apps
  deploy.sh-wrapper         validates the forced SSH command
  backup.sh                 nightly pg_dump
  .env                      POSTGRES_PASSWORD + pinned image tags (compose)
  .env.production           runtime secrets for the containers
  backups/                  database dumps (last 14)
  deploys.log               commit + target per deploy
/etc/cron.d/obh             webhook worker (every minute) + nightly backup
/var/log/obh.log            cron output
```

`obh-deploy` is a system user with a key restricted to
`command="/opt/obh/deploy.sh-wrapper"`; its sudoers entry allows only
`/opt/obh/deploy.sh`.

## First-time setup (already done)

```sh
mkdir -p /opt/obh/backups
# copy compose.yml, deploy.sh, deploy.sh-wrapper, backup.sh
# write .env  (POSTGRES_PASSWORD, WEB_TAG=latest, DOCS_TAG=latest)
# write .env.production (DATABASE_URL, AUTH_SECRET, APP_URL, …)
# install /etc/cron.d/obh from crontab
```

Then push to `master`. The first deploy creates the schema (`prisma db push`),
starts Postgres, web and docs, and the proxy issues the TLS certificate once
DNS resolves.

Create the first manager after the database exists (credentials come from the
server env, never from Git):

```sh
cd /opt/obh
docker compose run --rm -T web pnpm --filter web auth:create-manager
```

Then remove `ADMIN_PASSWORD` from `.env.production`.

## Day-to-day

- **Deploy**: merge/push to `master`. Watch the two workflow runs. A deploy only
  succeeds after the proxy returns 200 for both `/` and `/docs`.
- **Roll back**: Actions → *Deploy to production* → Run workflow → full sha of
  the commit to restore (images are kept in GHCR, and the server keeps the
  current and previous tags locally).
- **Logs**: `docker compose -f /opt/obh/compose.yml logs -f web`
- **Status**: `docker compose -f /opt/obh/compose.yml ps`
- **Manual deploy**: `/opt/obh/deploy.sh <sha> [web|docs|both]`

## Backups

`/etc/cron.d/obh` dumps the database nightly to `/opt/obh/backups` (14 kept,
mode 600) and logs to `/var/log/obh.log`. Copy dumps off the server; the
expense-document volume (`obh_documents`) must be backed up together with the
database so `ExpenseDocument.storageKey` stays meaningful.

`prisma db push` applies destructive schema changes without asking, so take a
dump before deploying a commit that changes `apps/web/prisma/schema.prisma`.

## Resource notes

The VPS has ~3.7 GB RAM and other live apps. The stack is capped at
512 MB (Postgres) + 1 GB (web) + 512 MB (docs); tweak `mem_limit` in
`compose.yml` if the host starts swapping.

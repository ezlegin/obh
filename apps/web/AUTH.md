# Authentication and admin access

## Stack

- Auth.js v5 (`next-auth@5.0.0-beta.32`, pinned)
- Credentials provider with email and password
- JWT sessions, 8-hour maximum age
- bcrypt password hashing with cost factor 12
- `proxy.ts` for optimistic redirects in Next.js 16
- A database-backed admin guard for every protected page

Auth.js v5 is still published as a beta. The version is pinned so an automatic
beta update cannot change authentication behavior silently.

## Environment

Both values are required for a usable login:

```dotenv
DATABASE_URL="postgresql://..."
AUTH_SECRET="<random 32-byte base64 secret>"
```

Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

The local `.env.local` contains local development secrets and database settings;
it is ignored by Git. For deployment, set both variables through the hosting
environment.

`AUTH_SECRET` is also used to derive the encryption key for stored service
credentials. Rotating it makes the existing encrypted credentials unreadable;
re-issue them in Admin → Services. See `PAYMENT_API.md`.

## Create a manager

There is no public registration or password-reset flow. Managers are provisioned
only through the server-side CLI after the schema has been pushed:

```bash
pnpm auth:create-manager
```

The command prompts for email, password, and confirmation with the password
hidden. For an automated environment, provide the values explicitly:

```bash
ADMIN_EMAIL="manager@example.com" \
ADMIN_NAME="OBH Manager" \
ADMIN_PASSWORD="a-long-local-password" \
pnpm auth:create-manager
```

Passwords must be 12–72 characters. The CLI refuses to overwrite an existing
email and never prints the password or hash.

To set or reset the password of an existing manager from `ADMIN_EMAIL` and
`ADMIN_PASSWORD`, use the idempotent reset command:

```bash
ADMIN_EMAIL="manager@example.com" ADMIN_PASSWORD="..." pnpm auth:reset-manager
```

It creates the manager if missing, otherwise replaces the password and reactivates
the account. It prints only whether the password verifies, never the password or
hash.

If `DATABASE_URL` points to a database that has not been created yet, create it
first:

```bash
pnpm db:ensure
pnpm db:push
```

## Protection model

1. `proxy.ts` validates the signed Auth.js JWT for `/admin/:path*` and redirects
   unauthenticated visitors to `/login`, preserving a safe callback URL.
2. `app/admin/layout.tsx` calls `requireAdmin()`, which verifies the session and
   checks that the manager record still exists and is active in PostgreSQL.
3. Future admin Server Actions and Route Handlers must call `requireAdmin()`
   themselves. The proxy is not the security boundary.
4. Admin responses are marked `noindex` and are dynamically rendered.

A valid JWT alone is not enough to reach an admin page: the database user must
still be active.

## Password and callback safety

- Invalid emails and invalid passwords return the same generic error.
- Missing accounts still perform a dummy bcrypt comparison to reduce timing
  differences.
- The callback URL is restricted to `/admin` or `/admin/...`; external URLs and
  protocol-relative URLs fall back to `/admin`.
- Session cookies are `HttpOnly` and `SameSite=Lax`. Auth.js sets `Secure` when
  the application is served over HTTPS.
- Password hashes and secrets are never sent to the browser.

## Known limitations

- No login rate limiting or account lockout is implemented yet. Add a trusted
  proxy-aware limiter before production deployment.
- No MFA, password reset, user invitation UI, or role management exists.
- JWT sessions cannot be revoked instantly; an 8-hour maximum applies and the
  active-user guard still blocks deactivated users on the next admin request.
- `trustHost` is enabled so Auth.js can infer the host behind a trusted
  deployment proxy. Ensure the production proxy sets a trustworthy Host header.
- The only account type currently modeled is the manager identity. Any future
  roles require an explicit authorization design.

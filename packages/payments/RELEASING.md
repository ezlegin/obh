# Releasing `@obh/payments`

Current version: **0.1.0**  
Status: **prepared, not published**

## Versioning policy

- Follow semantic versioning.
- A breaking API/SDK contract change requires a major version.
- New backwards-compatible SDK methods or optional fields require a minor
  version.
- Fixes and documentation-only corrections use a patch version.
- The versioned HTTP contract and SDK major version must remain explicit in the
  package README and OBH payment API documentation.
- Update `CHANGELOG.md` in every release.

## Pre-release checks

```bash
pnpm --filter @obh/payments typecheck
pnpm --filter @obh/payments test
pnpm --filter @obh/payments build
pnpm test
pnpm test:integration   # requires the local API and test database
pnpm --filter @obh/payments pack --dry-run
```

Review the tarball contents. It must contain only `dist/`, `README.md`,
`CHANGELOG.md`, and `package.json` metadata. Never include source maps pointing to
private infrastructure secrets, tests, `.env` files, or local credentials.

## Publishing

Do **not** publish without explicit approval and npm organization access.

```bash
pnpm --filter @obh/payments build
pnpm --filter @obh/payments pack
npm publish --access public
```

A scoped publish requires the `@obh` npm organization and authorization. Package
license/legal status (`UNLICENSED`) must be reviewed before any public release.

Use `next` for a pre-release candidate rather than overwriting `latest`, for
example `npm publish --tag next`, until the SDK review is complete.

## After publishing

- Verify `npm view @obh/payments@<version>` and the package entrypoints from a
  clean consumer project.
- Keep `CHANGELOG.md` and the API compatibility notes updated.
- Announce only the capabilities that were actually verified. Real-provider
  integration has not been certified.
- Tag the repository release and record the API contract version.

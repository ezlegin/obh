// The docs app is served from the main site under /docs (see next.config.ts).
// basePath is inlined into the client bundle at build time, so this value and
// the config value must stay in sync.
export const docsBasePath = "/docs"

// Absolute URL of the docs root. Used for canonical metadata, sitemap and
// robots entries. Set NEXT_PUBLIC_DOCS_URL at build time in production.
export const docsSiteUrl = (
  process.env.NEXT_PUBLIC_DOCS_URL ?? `http://localhost:3200${docsBasePath}`
).replace(/\/$/, "")

// The docs are part of the web app, under app/docs.
export const docsBasePath = "/docs"

// Absolute URL of the docs root. Used for canonical metadata, sitemap and
// robots entries. Set NEXT_PUBLIC_DOCS_URL at build time in production.
export const docsSiteUrl = (
  process.env.NEXT_PUBLIC_DOCS_URL ?? `http://localhost:3000${docsBasePath}`
).replace(/\/$/, "")

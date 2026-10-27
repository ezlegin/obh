import type { NextConfig } from "next"

// The docs app runs as its own container (basePath /docs) behind this server,
// so the public site needs a single origin and no extra domain. Rewrites are
// compiled into the build, hence DOCS_INTERNAL_URL is a build-time value
// (Dockerfile sets http://docs:3200; local dev falls back to the docs dev port).
const docsInternalUrl = (
  process.env.DOCS_INTERNAL_URL ?? "http://localhost:3200"
).replace(/\/$/, "")

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  devIndicators: false,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/docs", destination: `${docsInternalUrl}/docs` },
      { source: "/docs/:path*", destination: `${docsInternalUrl}/docs/:path*` },
    ]
  },
  async headers() {
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ]

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      })
    }

    return [{ source: "/(.*)", headers }]
  },
}

export default nextConfig

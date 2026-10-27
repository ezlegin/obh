import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The docs app is published under https://obhco.ir/docs (the web app
  // rewrites /docs to this server). Kept in sync with lib/site.ts.
  basePath: "/docs",
  transpilePackages: ["@workspace/ui"],
  devIndicators: false,
  poweredByHeader: false,
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

import type { MetadataRoute } from "next"

const siteUrl =
  process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3200"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  }
}

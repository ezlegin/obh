import type { MetadataRoute } from "next"

import { docsSiteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${docsSiteUrl}/sitemap.xml`,
  }
}

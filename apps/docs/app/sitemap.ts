import type { MetadataRoute } from "next"

import { flatNavigation } from "@/lib/navigation"

const siteUrl =
  process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3200"

export default function sitemap(): MetadataRoute.Sitemap {
  return flatNavigation.map((item) => ({
    url: new URL(item.href, siteUrl).toString(),
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: item.href === "/" ? 1 : 0.7,
  }))
}

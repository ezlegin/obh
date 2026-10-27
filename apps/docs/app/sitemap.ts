import type { MetadataRoute } from "next"

import { flatNavigation } from "@/lib/navigation"
import { docsSiteUrl } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  return flatNavigation.map((item) => ({
    // The base path itself has no trailing slash (Next redirects /docs/ -> /docs).
    url: item.href === "/" ? docsSiteUrl : `${docsSiteUrl}${item.href}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: item.href === "/" ? 1 : 0.7,
  }))
}

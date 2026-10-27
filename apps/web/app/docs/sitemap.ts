import type { MetadataRoute } from "next"

import { flatNavigation } from "@/lib/docs/navigation"
import { docsBasePath, docsSiteUrl } from "@/lib/docs/site"

export default function sitemap(): MetadataRoute.Sitemap {
  return flatNavigation.map((item) => ({
    // Navigation hrefs already start with /docs; docsSiteUrl ends in /docs.
    url: `${docsSiteUrl}${item.href.slice(docsBasePath.length)}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: item.href === docsBasePath ? 1 : 0.7,
  }))
}

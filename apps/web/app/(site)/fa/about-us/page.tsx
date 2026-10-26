import type { Metadata } from "next"

import { AboutPage } from "@/components/site-pages/about-page"
import { getDictionary } from "@/lib/i18n"
import { fa } from "@/lib/i18n/fa"

export const metadata: Metadata = {
  title: fa.about.meta.title,
  description: fa.about.meta.description,
}

export default function Page() {
  return <AboutPage locale="fa" dictionary={getDictionary("fa")} />
}

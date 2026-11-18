import type { Metadata } from "next"

import { AboutPage } from "@/components/site-pages/about-page"
import { getDictionary } from "@/lib/i18n"
import { en } from "@/lib/i18n/en"

export const metadata: Metadata = {
  title: en.about.meta.title,
  description: en.about.meta.description,
}

export default function Page() {
  return <AboutPage locale="en" dictionary={getDictionary("en")} />
}

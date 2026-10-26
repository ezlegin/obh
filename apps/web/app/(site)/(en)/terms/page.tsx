import type { Metadata } from "next"

import { TermsPage } from "@/components/site-pages/terms-page"
import { getDictionary } from "@/lib/i18n"
import { en } from "@/lib/i18n/en"

export const metadata: Metadata = {
  title: en.terms.meta.title,
  description: en.terms.meta.description,
}

export default function Page() {
  return <TermsPage locale="en" dictionary={getDictionary("en")} />
}

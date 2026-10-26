import type { Metadata } from "next"

import { TermsPage } from "@/components/site-pages/terms-page"
import { getDictionary } from "@/lib/i18n"
import { fa } from "@/lib/i18n/fa"

export const metadata: Metadata = {
  title: fa.terms.meta.title,
  description: fa.terms.meta.description,
}

export default function Page() {
  return <TermsPage locale="fa" dictionary={getDictionary("fa")} />
}

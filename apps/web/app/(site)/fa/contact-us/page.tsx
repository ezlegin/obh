import type { Metadata } from "next"

import { ContactPage } from "@/components/site-pages/contact-page"
import { getDictionary } from "@/lib/i18n"
import { fa } from "@/lib/i18n/fa"

export const metadata: Metadata = {
  title: fa.contact.meta.title,
  description: fa.contact.meta.description,
}

export default function Page() {
  return <ContactPage locale="fa" dictionary={getDictionary("fa")} />
}

import type { Metadata } from "next"

import { ContactPage } from "@/components/site-pages/contact-page"
import { getDictionary } from "@/lib/i18n"
import { en } from "@/lib/i18n/en"

export const metadata: Metadata = {
  title: en.contact.meta.title,
  description: en.contact.meta.description,
}

export default function Page() {
  return <ContactPage locale="en" dictionary={getDictionary("en")} />
}

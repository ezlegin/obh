import type { Metadata } from "next"

import { ContactPage } from "@/components/site-pages/contact-page"
import { getDictionary } from "@/lib/i18n"
import { en } from "@/lib/i18n/en"

// Contact details (phone, email, address) come from OBH_PHONE, OBH_EMAIL,
// and OBH_ADDRESS inside ContactPage.
export const metadata: Metadata = {
  title: en.contact.meta.title,
  description: en.contact.meta.description,
}

export default function Page() {
  return <ContactPage locale="en" dictionary={getDictionary("en")} />
}

import type { Metadata } from "next"

import { TeamPage } from "@/components/site-pages/team-page"
import { getDictionary } from "@/lib/i18n"
import { en } from "@/lib/i18n/en"

export const metadata: Metadata = {
  title: en.team.meta.title,
  description: en.team.meta.description,
}

export default function Page() {
  return <TeamPage locale="en" dictionary={getDictionary("en")} />
}

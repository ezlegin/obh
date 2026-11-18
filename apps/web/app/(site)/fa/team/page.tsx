import type { Metadata } from "next"

import { TeamPage } from "@/components/site-pages/team-page"
import { getDictionary } from "@/lib/i18n"
import { fa } from "@/lib/i18n/fa"

export const metadata: Metadata = {
  title: fa.team.meta.title,
  description: fa.team.meta.description,
}

export default function Page() {
  return <TeamPage locale="fa" dictionary={getDictionary("fa")} />
}

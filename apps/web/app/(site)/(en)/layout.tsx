import type { ReactNode } from "react"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getDictionary } from "@/lib/i18n"

export default function EnglishSiteLayout({
  children,
}: {
  children: ReactNode
}) {
  const dictionary = getDictionary("en")

  return (
    <div lang="en" dir="ltr" className="flex min-h-dvh flex-col">
      <SiteHeader
        locale="en"
        labels={dictionary.header}
        navigation={dictionary.nav}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter locale="en" dictionary={dictionary} />
    </div>
  )
}

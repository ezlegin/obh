import type { ReactNode } from "react"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getDictionary } from "@/lib/i18n"

import styles from "./site-fa.module.css"

export default function PersianSiteLayout({
  children,
}: {
  children: ReactNode
}) {
  const dictionary = getDictionary("fa")

  return (
    <div
      lang="fa"
      dir="rtl"
      className={`${styles.root} flex min-h-dvh flex-col`}
    >
      <SiteHeader locale="fa" dictionary={dictionary} />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter locale="fa" dictionary={dictionary} />
    </div>
  )
}

import { ArrowLeft, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { TableOfContents } from "@/components/table-of-contents"
import { getAdjacentDocs } from "@/lib/navigation"

export type DocSection = {
  id: string
  title: string
}

type DocPageProps = {
  href: string
  eyebrow?: string
  title: string
  description: ReactNode
  sections: DocSection[]
  children: ReactNode
}

export function DocPage({
  href,
  eyebrow,
  title,
  description,
  sections,
  children,
}: DocPageProps) {
  const { previous, next } = getAdjacentDocs(href)

  return (
    <div className="flex gap-12 pb-24">
      <article className="doc-prose min-w-0 max-w-[47rem] flex-1">
        <header className="mb-9 border-b border-white/[0.07] pb-8">
          {eyebrow ? (
            <p className="mb-3 text-[0.65rem] font-medium tracking-[0.16em] text-white/40 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[2rem] leading-[1.15] font-semibold tracking-[-0.035em] text-foreground sm:text-[2.4rem]">
            {title}
          </h1>
          <p className="doc-lead mt-4 max-w-[42rem]">{description}</p>
        </header>

        {children}

        <nav
          aria-label="Documentation pagination"
          className="not-prose mt-16 grid gap-3 border-t border-white/[0.07] pt-8 sm:grid-cols-2"
        >
          {previous ? (
            <Link
              href={previous.href}
              className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
            >
              <span className="flex items-center gap-1.5 text-[0.65rem] tracking-[0.1em] text-white/35 uppercase">
                <ArrowLeft aria-hidden="true" className="size-3" />
                Previous
              </span>
              <span className="mt-1 text-[0.85rem] font-medium text-foreground">
                {previous.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}

          {next ? (
            <Link
              href={next.href}
              className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.04] sm:items-end sm:text-right"
            >
              <span className="flex items-center gap-1.5 text-[0.65rem] tracking-[0.1em] text-white/35 uppercase">
                Next
                <ArrowRight aria-hidden="true" className="size-3" />
              </span>
              <span className="mt-1 text-[0.85rem] font-medium text-foreground">
                {next.title}
              </span>
            </Link>
          ) : null}
        </nav>
      </article>

      <aside className="hidden w-[13rem] shrink-0 xl:block">
        <div className="sticky top-24">
          <TableOfContents sections={sections} />
        </div>
      </aside>
    </div>
  )
}

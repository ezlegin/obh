import Image from "next/image"
import Link from "next/link"

import { MobileNav } from "@/components/docs/mobile-nav"
import { SearchDialog } from "@/components/docs/search-dialog"

export function DocsHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#080808]/85 backdrop-blur-xl">
      <div className="docs-shell flex h-16 items-center gap-4">
        <Link
          href="/docs/docs"
          aria-label="OBH Payments documentation home"
          className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <Image
            src="/docs/obh-logo.svg"
            alt="OBH"
            width={235}
            height={87}
            priority
            className="h-[1.15rem] w-auto select-none"
          />
          <span aria-hidden="true" className="h-4 w-px bg-white/15" />
          <span className="text-[0.8rem] font-medium text-white/70">
            Payments
          </span>
        </Link>

        <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[0.6rem] text-white/40 sm:inline">
          SDK v0.1.0
        </span>

        <nav
          aria-label="Top navigation"
          className="ml-4 hidden items-center gap-1 md:flex"
        >
          <Link
            href="/docs/quickstart"
            className="rounded-md px-2.5 py-1.5 text-[0.78rem] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            Quickstart
          </Link>
          <Link
            href="/docs/api-reference"
            className="rounded-md px-2.5 py-1.5 text-[0.78rem] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            API reference
          </Link>
          <Link
            href="/docs/guides/nextjs"
            className="rounded-md px-2.5 py-1.5 text-[0.78rem] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            Next.js
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchDialog />
          <MobileNav />
        </div>
      </div>
    </header>
  )
}

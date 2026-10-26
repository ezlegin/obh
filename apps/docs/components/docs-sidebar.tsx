import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { SidebarNav } from "@/components/sidebar-nav"

export function DocsSidebar() {
  return (
    <aside className="hidden w-[15.5rem] shrink-0 border-r border-white/[0.07] lg:block">
      <div className="sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto py-7 pr-5 docs-scroll">
        <SidebarNav />

        <div className="mt-9 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
          <p className="flex items-center gap-1.5 text-[0.63rem] font-medium tracking-[0.12em] text-warning uppercase">
            <span className="size-1.5 rounded-full bg-warning" />
            Pre-release
          </p>
          <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
            Version{" "}
            <span className="font-mono text-white/70">0.1.0</span> is not
            published. It is tested against the local API and development
            adapter only.
          </p>
          <Link
            href="/#status"
            className="mt-2.5 inline-flex items-center gap-1 text-[0.7rem] text-white/60 transition-colors hover:text-foreground"
          >
            Read the status
            <ArrowUpRight aria-hidden="true" className="size-3" />
          </Link>
        </div>
      </div>
    </aside>
  )
}

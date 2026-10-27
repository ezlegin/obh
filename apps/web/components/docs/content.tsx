import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

export function Endpoint({
  method,
  path,
  className,
}: {
  method: "GET" | "POST"
  path: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "not-prose my-4 flex items-center gap-3 rounded-lg border border-white/10 bg-[#0b0b0b] px-3.5 py-2.5",
        className
      )}
    >
      <span
        className={cn(
          "rounded border px-1.5 py-0.5 font-mono text-[0.62rem] font-medium tracking-wide",
          method === "POST"
            ? "border-info/30 bg-info/10 text-info"
            : "border-success/30 bg-success/10 text-success"
        )}
      >
        {method}
      </span>
      <code className="overflow-x-auto font-mono text-[0.8rem] whitespace-nowrap text-[#d8d8d1]">
        {path}
      </code>
    </div>
  )
}

export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6 grid gap-3 sm:grid-cols-2">{children}</div>
  )
}

export function LinkCard({
  href,
  title,
  children,
  icon,
}: {
  href: string
  title: string
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className="text-muted-foreground transition-colors group-hover:text-foreground">
            {icon}
          </span>
        ) : null}
        <span className="text-[0.85rem] font-medium text-foreground">
          {title}
        </span>
        <ArrowRight
          aria-hidden="true"
          className="ml-auto size-3.5 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </div>
      <p className="mt-2 text-[0.78rem] leading-relaxed text-muted-foreground">
        {children}
      </p>
    </Link>
  )
}

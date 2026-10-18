import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"

type AdminPageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 lg:flex-row lg:items-end">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 text-3xl leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

type AdminModulePlaceholderProps = {
  icon: LucideIcon
  title: string
  description: string
}

function AdminModulePlaceholder({
  icon: Icon,
  title,
  description,
}: AdminModulePlaceholderProps) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <Badge variant="outline" className="mt-6">
          Protected module
        </Badge>
        <h2 className="mt-4 text-xl font-medium tracking-[-0.02em]">
          This section is ready.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {description} No records are displayed until the {title.toLowerCase()}{" "}
          module is implemented.
        </p>
      </div>
    </div>
  )
}

export { AdminModulePlaceholder, AdminPageHeader }

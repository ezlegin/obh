import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"

import { AdminEmptyState } from "@/components/admin/empty-state"

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
      <div className="flex justify-center border-b border-border py-4">
        <Badge variant="outline">Protected module</Badge>
      </div>
      <AdminEmptyState
        icon={Icon}
        title="This section is ready."
        description={`${description} No records are displayed until the ${title.toLowerCase()} module is implemented.`}
        className="min-h-[18rem]"
      />
    </div>
  )
}

export { AdminModulePlaceholder, AdminPageHeader }

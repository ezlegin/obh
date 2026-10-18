import type { LucideIcon } from "lucide-react"

import {
  AdminModulePlaceholder,
  AdminPageHeader,
} from "@/components/admin/admin-page"

type AdminModuleViewProps = {
  eyebrow: string
  title: string
  description: string
  emptyDescription: string
  icon: LucideIcon
}

function AdminModuleView({
  eyebrow,
  title,
  description,
  emptyDescription,
  icon,
}: AdminModuleViewProps) {
  return (
    <>
      <AdminPageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <AdminModulePlaceholder
        icon={icon}
        title={title}
        description={emptyDescription}
      />
    </>
  )
}

export { AdminModuleView }

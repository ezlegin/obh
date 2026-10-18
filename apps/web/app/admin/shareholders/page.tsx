import type { Metadata } from "next"
import { Users } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Shareholders",
}

export default function AdminShareholdersPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Equity"
      title="Shareholders"
      description="Shareholder profiles, ownership history, capital contributions, and their relationship to distributions."
      emptyDescription="Shareholder profiles and historical ownership records will appear here."
      icon={Users}
    />
  )
}

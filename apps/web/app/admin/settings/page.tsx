import type { Metadata } from "next"
import { Settings } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Settings",
}

export default function AdminSettingsPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / System"
      title="Settings"
      description="Business information, payment methods, expense categories, distribution rules, and security preferences."
      emptyDescription="Configurable business and application settings will appear here after the relevant rules are confirmed."
      icon={Settings}
    />
  )
}

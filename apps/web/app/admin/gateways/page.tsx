import type { Metadata } from "next"
import { Landmark } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Gateways",
}

export default function AdminGatewaysPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Operations"
      title="Gateways"
      description="Payment providers, provider accounts, fees, settlements, transfers, and manual balance reconciliation."
      emptyDescription="Provider accounts and reconciliation records will appear here."
      icon={Landmark}
    />
  )
}

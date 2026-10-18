import type { Metadata } from "next"
import { PieChart } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Distributions",
}

export default function AdminDistributionsPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Equity"
      title="Distributions"
      description="Profit periods, calculated allocations, manager approval, and shareholder payouts with historical snapshots."
      emptyDescription="Profit calculations, approvals, and payout records will appear here after the distribution rules are confirmed."
      icon={PieChart}
    />
  )
}

import type { Metadata } from "next"
import { FileText } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Reports",
}

export default function AdminReportsPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Accounting"
      title="Reports"
      description="Revenue, expenses, net profit, cash flow, gateway balances, and shareholder distributions with date and category filters."
      emptyDescription="Financial reports and exports will appear here once real records are available."
      icon={FileText}
    />
  )
}

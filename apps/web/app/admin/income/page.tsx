import type { Metadata } from "next"
import { CircleDollarSign } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Income",
}

export default function AdminIncomePage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Accounting"
      title="Income"
      description="Additional business income kept separate from incoming payment transactions and shareholder capital."
      emptyDescription="Additional income records and their source accounts will appear here."
      icon={CircleDollarSign}
    />
  )
}

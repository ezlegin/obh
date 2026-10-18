import type { Metadata } from "next"
import { Receipt } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Expenses",
}

export default function AdminExpensesPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Accounting"
      title="Expenses"
      description="Operating costs, categories, payment sources, recurring costs, and supporting documents."
      emptyDescription="Expense records and linked invoices or receipts will appear here."
      icon={Receipt}
    />
  )
}

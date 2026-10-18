import type { Metadata } from "next"
import { CreditCard } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Payments",
}

export default function AdminPaymentsPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Operations"
      title="Payments"
      description="Incoming and outgoing payment records, provider references, transaction status, and verification history."
      emptyDescription="Payment records, lifecycle events, and connected-service references will appear here."
      icon={CreditCard}
    />
  )
}

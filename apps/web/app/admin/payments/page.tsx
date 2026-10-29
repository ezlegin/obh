import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { PaymentsManager } from "@/components/admin/payments/payments-manager"
import { getPaymentsForAdmin } from "@/server/payments/queries"

export const metadata: Metadata = {
  title: "Payments",
}

export default async function AdminPaymentsPage() {
  const payments = await getPaymentsForAdmin()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Payments"
        description="Payments reported by each connected service from its own gateway terminal: status, originating service, gateway, and receipt numbers."
        actions={<Badge variant="outline">{payments.length} records</Badge>}
      />
      <PaymentsManager payments={payments} />
    </>
  )
}

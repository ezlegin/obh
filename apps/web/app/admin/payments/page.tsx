import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { PaymentsManager } from "@/components/admin/payments/payments-manager"
import {
  getActiveServicesForPayment,
  getPaymentsForAdmin,
} from "@/server/payments/queries"

export const metadata: Metadata = {
  title: "Payments",
}

export default async function AdminPaymentsPage() {
  const [payments, services] = await Promise.all([
    getPaymentsForAdmin(),
    getActiveServicesForPayment(),
  ])

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Payments"
        description="Authoritative Sadad (Bank Melli) payment records, lifecycle status, originating service, and gateway receipt numbers (OrderId, SystemTraceNo, RetrivalRefNo)."
        actions={<Badge variant="outline">{payments.length} records</Badge>}
      />
      <PaymentsManager payments={payments} services={services} />
    </>
  )
}

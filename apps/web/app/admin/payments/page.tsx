import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { PaymentsManager } from "@/components/admin/payments/payments-manager"
import {
  getActiveServicesForPayment,
  getPaymentsForAdmin,
} from "@/server/payments/queries"
import { listPaymentGatewaysForAdmin } from "@/server/payments/providers/registry"

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
        description="Authoritative payment records across Sadad and Digipay: lifecycle status, originating service, gateway, and receipt numbers."
        actions={<Badge variant="outline">{payments.length} records</Badge>}
      />
      <PaymentsManager
        payments={payments}
        services={services}
        gateways={listPaymentGatewaysForAdmin()}
      />
    </>
  )
}

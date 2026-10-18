import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { PaymentsManager } from "@/components/admin/payments/payments-manager"
import {
  getActiveDevelopmentAccountsForPayment,
  getActiveServicesForPayment,
  getPaymentsForAdmin,
} from "@/server/payments/queries"

export const metadata: Metadata = {
  title: "Payments",
}

export default async function AdminPaymentsPage() {
  const [payments, services, accounts] = await Promise.all([
    getPaymentsForAdmin(),
    getActiveServicesForPayment(),
    getActiveDevelopmentAccountsForPayment(),
  ])

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Payments"
        description="Authoritative payment records, lifecycle status, originating service, and provider references. This step supports TEST payments through the development adapter only."
        actions={<Badge variant="outline">{payments.length} records</Badge>}
      />
      <PaymentsManager
        payments={payments}
        services={services}
        accounts={accounts}
      />
    </>
  )
}

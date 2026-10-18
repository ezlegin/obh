import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { GatewayManager } from "@/components/admin/gateways/gateway-manager"
import { getPaymentProvidersForAdmin } from "@/server/payments/queries"

export const metadata: Metadata = {
  title: "Gateways",
}

export default async function AdminGatewaysPage() {
  const providers = await getPaymentProvidersForAdmin()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Gateways"
        description="Provider and provider-account configuration for the OBH payment layer. Only the local development adapter is available at this stage."
        actions={
          <Badge variant="outline">
            {providers.length}{" "}
            {providers.length === 1 ? "provider" : "providers"}
          </Badge>
        }
      />
      <GatewayManager providers={providers} />
    </>
  )
}

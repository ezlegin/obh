import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { GatewayManager } from "@/components/admin/gateways/gateway-manager"
import { getSadadGatewayForAdmin } from "@/server/payments/queries"

export const metadata: Metadata = {
  title: "Sadad Gateway",
}

export default async function AdminGatewaysPage() {
  const gateway = await getSadadGatewayForAdmin()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Sadad Gateway"
        description="Read-only configuration status, callback endpoint, and automatically provisioned settlement accounts for the single Sadad (Bank Melli Iran) Internet Payment Gateway."
        actions={
          <Badge variant={gateway.config.liveConfigured ? "success" : "warning"}>
            {gateway.config.liveConfigured
              ? "Live terminal configured"
              : "Simulator mode (TEST)"}
          </Badge>
        }
      />
      <GatewayManager gateway={gateway} />
    </>
  )
}

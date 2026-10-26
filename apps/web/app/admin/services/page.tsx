import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { ServicesManager } from "@/components/admin/services/services-manager"
import { getConnectedServicesForAdmin } from "@/server/payments/queries"

export const metadata: Metadata = {
  title: "Connected services",
}

export default async function AdminServicesPage() {
  const services = await getConnectedServicesForAdmin()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Connected services"
        description="Register the services that use OBH payment infrastructure, manage their return URL allowlists, and issue or copy TEST and LIVE credentials."
        actions={<Badge variant="outline">{services.length} registered</Badge>}
      />
      <ServicesManager services={services} />
    </>
  )
}

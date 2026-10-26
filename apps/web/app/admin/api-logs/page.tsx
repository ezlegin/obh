import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { ApiLogsManager } from "@/components/admin/api-logs/api-logs-manager"
import { getApiLogsForAdmin } from "@/server/api/api-logs"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "API logs",
}

export default async function AdminApiLogsPage() {
  const { logs, services } = await getApiLogsForAdmin()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="API logs"
        description="Valid HTTP API requests authenticated with a connected service credential (POST /api/v1/payments and GET /api/v1/payments/{reference})."
        actions={<Badge variant="outline">{logs.length} calls</Badge>}
      />
      <ApiLogsManager logs={logs} services={services} />
    </>
  )
}

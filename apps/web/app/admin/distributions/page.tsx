import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { DistributionsWorkspace } from "@/components/admin/distributions/distributions-workspace"
import {
  getDistributionsWorkspace,
  getShareholderWorkspace,
} from "@/server/equity/queries"

export const metadata: Metadata = {
  title: "Distributions",
}

export default async function AdminDistributionsPage() {
  const [data, shareholders] = await Promise.all([
    getDistributionsWorkspace(),
    getShareholderWorkspace(),
  ])

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Equity"
        title="Distributions"
        description="Monthly profit calculations, period-end ownership snapshots, manager approval, and full shareholder payouts with an immutable history."
        actions={
          <Badge variant="outline">
            {data.periods.length}{" "}
            {data.periods.length === 1 ? "period" : "periods"}
          </Badge>
        }
      />
      <DistributionsWorkspace
        data={data}
        currentOwnershipTotal={shareholders.currentTotal}
        shareholderCount={shareholders.shareholders.length}
      />
    </>
  )
}

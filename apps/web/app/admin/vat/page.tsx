import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { VatWorkspace } from "@/components/admin/vat/vat-workspace"
import { getVatWorkspace } from "@/server/vat/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "VAT",
}

export default async function AdminVatPage() {
  const data = await getVatWorkspace()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Accounting"
        title="VAT"
        description="Value added tax (مالیات بر ارزش افزوده). From the registration date, gateway payments are treated as VAT-inclusive, the VAT is kept out of revenue, and each Solar Hijri quarter's return is due by the end of the following month."
        actions={
          <Badge variant="outline">
            Today · {data.todayPersian} · rate {data.currentRatePercent}%
          </Badge>
        }
      />
      <VatWorkspace data={data} />
    </>
  )
}

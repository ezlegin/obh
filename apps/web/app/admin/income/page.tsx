import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { IncomeWorkspace } from "@/components/admin/income/income-workspace"
import { getIncomeWorkspace } from "@/server/accounting/queries"

export const metadata: Metadata = {
  title: "Income",
}

export default async function AdminIncomePage() {
  const data = await getIncomeWorkspace()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Accounting"
        title="Income"
        description="Additional business income kept separate from incoming payment transactions and shareholder capital."
        actions={
          <Badge variant="outline">
            {data.incomes.length}{" "}
            {data.incomes.length === 1 ? "record" : "records"}
          </Badge>
        }
      />
      <IncomeWorkspace data={data} />
    </>
  )
}

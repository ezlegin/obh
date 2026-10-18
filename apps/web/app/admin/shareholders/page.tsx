import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { ShareholdersWorkspace } from "@/components/admin/shareholders/shareholders-workspace"
import { getShareholderWorkspace } from "@/server/equity/queries"

export const metadata: Metadata = {
  title: "Shareholders",
}

export default async function AdminShareholdersPage() {
  const data = await getShareholderWorkspace()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Equity"
        title="Shareholders"
        description="Shareholder profiles and historical ownership records. Profit distributions snapshot period-end ownership so later changes cannot rewrite history."
        actions={
          <Badge variant="outline">
            {data.shareholders.length}{" "}
            {data.shareholders.length === 1 ? "profile" : "profiles"}
          </Badge>
        }
      />
      <ShareholdersWorkspace data={data} />
    </>
  )
}

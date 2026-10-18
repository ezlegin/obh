import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { ReconciliationWorkspace } from "@/components/admin/reconciliation/reconciliation-workspace"
import { getReconciliationWorkspace } from "@/server/reconciliation/queries"

export const metadata: Metadata = {
  title: "Reconciliation",
}

export default async function AdminReconciliationPage() {
  const data = await getReconciliationWorkspace()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Reconciliation"
        description="Provider fees, settlements, calculated gateway balances, and reconciliation against actual provider statements."
        actions={
          <Badge variant="outline">
            {data.accounts.length}{" "}
            {data.accounts.length === 1 ? "account" : "accounts"}
          </Badge>
        }
      />
      <ReconciliationWorkspace data={data} />
    </>
  )
}

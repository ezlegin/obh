import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { AccountsManager } from "@/components/admin/accounts/accounts-manager"
import { getBusinessAccountsForAdmin } from "@/server/accounting/queries"

export const metadata: Metadata = {
  title: "Payment sources",
}

export default async function AdminAccountsPage() {
  const accounts = await getBusinessAccountsForAdmin()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Accounting"
        title="Payment sources"
        description="Business-owned bank, cash, and wallet accounts used as sources for income and expenses. Provider accounts stay in the gateway module."
        actions={
          <Badge variant="outline">
            {accounts.length} {accounts.length === 1 ? "source" : "sources"}
          </Badge>
        }
      />
      <AccountsManager accounts={accounts} />
    </>
  )
}

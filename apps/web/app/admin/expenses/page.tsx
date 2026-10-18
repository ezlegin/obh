import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { ExpensesWorkspace } from "@/components/admin/expenses/expenses-workspace"
import { getExpenseWorkspace } from "@/server/accounting/queries"

export const metadata: Metadata = {
  title: "Expenses",
}

export default async function AdminExpensesPage() {
  const data = await getExpenseWorkspace()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Accounting"
        title="Expenses"
        description="Operating costs, categories, payment sources, supporting documents, and approval-gated recurring rules."
        actions={
          <Badge variant="outline">
            {data.expenses.length}{" "}
            {data.expenses.length === 1 ? "record" : "records"}
          </Badge>
        }
      />
      <ExpensesWorkspace data={data} />
    </>
  )
}

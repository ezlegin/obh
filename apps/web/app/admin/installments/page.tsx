import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { InstallmentsWorkspace } from "@/components/admin/installments/installments-workspace"
import { getInstallmentsWorkspace } from "@/server/payments/installments/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Installments",
}

export default async function AdminInstallmentsPage() {
  const data = await getInstallmentsWorkspace()

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Operations"
        title="Installments"
        description="Installment (BNPL / credit) purchases. The customer pays the first installment at checkout, and the gateway deposits each remaining installment on the 7th of the following Iranian months. Only deposited installments count toward the business balance."
        actions={<Badge variant="outline">Today · {data.todayPersian}</Badge>}
      />
      <InstallmentsWorkspace data={data} />
    </>
  )
}

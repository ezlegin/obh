import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { TaxInvoicesWorkspace } from "@/components/admin/tax-invoices/tax-invoices-workspace"
import {
  getTaxInvoicesWorkspace,
  TAX_INVOICE_TABS,
  type TaxInvoiceTab,
} from "@/server/tax-invoices/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Tax invoices",
}

export default async function AdminTaxInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tab: tabParam } = await searchParams
  const tab: TaxInvoiceTab =
    TAX_INVOICE_TABS.find((item) => item === tabParam) ?? "attention"
  const data = await getTaxInvoicesWorkspace(tab)

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Accounting"
        title="Tax invoices"
        description="Electronic invoices in سامانه مودیان, sent through Kisan (the trusted company, memory id A49DW7). Every LIVE sale from the VAT registration date gets one: type 2, or type 1 when its service sent the buyer's details. They are sent and checked every 30 minutes; refused ones wait here to be fixed and sent again."
        actions={
          <Badge variant={data.configured ? "success" : "warning"}>
            {data.configured ? "Kisan connected" : "Kisan not configured"}
            {data.startsOn ? ` · from ${data.startsOn}` : ""}
          </Badge>
        }
      />
      <TaxInvoicesWorkspace data={data} />
    </>
  )
}

"use client"

import type { ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { TransactionStatusBadge } from "@/components/admin/transaction-status-badge"
import type { DevelopmentTransaction } from "@/lib/admin/development-data"
import { formatDevelopmentDateTime, formatIrr } from "@/lib/admin/format"

type TransactionDetailDialogProps = {
  transaction: DevelopmentTransaction | null
  onOpenChange: (open: boolean) => void
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground/60 uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground sm:text-right">{value}</dd>
    </div>
  )
}

function TransactionDetailDialog({
  transaction,
  onOpenChange,
}: TransactionDetailDialogProps) {
  if (!transaction) {
    return null
  }

  return (
    <AdminDialog
      open
      onOpenChange={onOpenChange}
      title={transaction.reference}
      description="A sample payment from the dashboard development preview."
    >
      <div className="flex flex-wrap items-center gap-2">
        <TransactionStatusBadge status={transaction.status} />
        <Badge variant="outline">Sample transaction</Badge>
      </div>

      <p className="mt-5 text-xl font-semibold tracking-[-0.03em] tabular-nums">
        {formatIrr(transaction.amount)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {transaction.description}
      </p>

      <dl className="mt-6 border-t border-border">
        <DetailRow label="Service" value={transaction.service} />
        <DetailRow label="Provider" value={transaction.provider} />
        <DetailRow
          label="External order"
          value={
            <span className="font-mono text-xs">
              {transaction.externalOrderId}
            </span>
          }
        />
        <DetailRow
          label="Created"
          value={formatDevelopmentDateTime(transaction.occurredAt)}
        />
        <DetailRow
          label="Verified"
          value={
            transaction.verifiedAt
              ? formatDevelopmentDateTime(transaction.verifiedAt)
              : "Awaiting verification"
          }
        />
      </dl>

      <div className="mt-6 rounded-xl border border-border bg-white/[0.025] p-4">
        <p className="text-xs leading-5 text-muted-foreground">
          This is demonstration data. It does not exist in the database and does
          not represent a real payment.
        </p>
      </div>

      <div className="mt-6 flex justify-end border-t border-border pt-5">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </AdminDialog>
  )
}

export { TransactionDetailDialog }

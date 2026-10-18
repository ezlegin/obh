import { Badge } from "@workspace/ui/components/badge"

const statusConfig = {
  PENDING: { label: "Pending", variant: "warning" as const },
  PAID: { label: "Paid", variant: "success" as const },
  VOIDED: { label: "Voided", variant: "muted" as const },
}

function ExpenseStatusBadge({
  status,
}: {
  status: "PENDING" | "PAID" | "VOIDED"
}) {
  const config = statusConfig[status]

  return (
    <Badge variant={config.variant}>
      <span aria-hidden="true" className="size-1 rounded-full bg-current" />
      {config.label}
    </Badge>
  )
}

const recurringConfig = {
  DRAFT: { label: "Draft · approval required", variant: "warning" as const },
  ACTIVE: { label: "Approved · active", variant: "success" as const },
  PAUSED: { label: "Paused", variant: "outline" as const },
  ENDED: { label: "Ended", variant: "muted" as const },
}

function RecurringStatusBadge({
  status,
}: {
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED"
}) {
  const config = recurringConfig[status]

  return <Badge variant={config.variant}>{config.label}</Badge>
}

export { ExpenseStatusBadge, RecurringStatusBadge }

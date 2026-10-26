import { Badge } from "@workspace/ui/components/badge"

import type { DashboardTransactionStatus } from "@/server/dashboard/queries"

type TransactionStatusBadgeProps = {
  status: DashboardTransactionStatus
}

const statusConfig = {
  completed: {
    label: "Completed",
    variant: "success" as const,
  },
  pending: {
    label: "Pending",
    variant: "warning" as const,
  },
  failed: {
    label: "Failed",
    variant: "danger" as const,
  },
  cancelled: {
    label: "Cancelled",
    variant: "outline" as const,
  },
  expired: {
    label: "Expired",
    variant: "outline" as const,
  },
}

function TransactionStatusBadge({ status }: TransactionStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge variant={config.variant}>
      <span aria-hidden="true" className="size-1 rounded-full bg-current" />
      {config.label}
    </Badge>
  )
}

export { TransactionStatusBadge }

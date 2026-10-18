import { Badge } from "@workspace/ui/components/badge"

import type { DevelopmentTransactionStatus } from "@/lib/admin/development-data"

type TransactionStatusBadgeProps = {
  status: DevelopmentTransactionStatus
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

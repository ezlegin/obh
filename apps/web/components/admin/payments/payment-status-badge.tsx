import { Badge } from "@workspace/ui/components/badge"

import type { AdminPaymentStatus } from "@/server/payments/queries"

const statusConfig = {
  PENDING: { label: "Pending", variant: "warning" as const },
  COMPLETED: { label: "Completed", variant: "success" as const },
  FAILED: { label: "Failed", variant: "danger" as const },
  CANCELLED: { label: "Cancelled", variant: "muted" as const },
  EXPIRED: { label: "Expired", variant: "outline" as const },
}

function PaymentStatusBadge({ status }: { status: AdminPaymentStatus }) {
  const config = statusConfig[status]

  return (
    <Badge variant={config.variant}>
      <span aria-hidden="true" className="size-1 rounded-full bg-current" />
      {config.label}
    </Badge>
  )
}

export { PaymentStatusBadge }

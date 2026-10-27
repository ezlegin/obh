import { cn } from "@workspace/ui/lib/utils"

type PaymentStatus =
  "pending" | "completed" | "failed" | "cancelled" | "expired"

const styles: Record<
  PaymentStatus,
  { dot: string; text: string; ring: string }
> = {
  pending: {
    dot: "bg-warning",
    text: "text-warning",
    ring: "border-warning/30 bg-warning/[0.07]",
  },
  completed: {
    dot: "bg-success",
    text: "text-success",
    ring: "border-success/30 bg-success/[0.07]",
  },
  failed: {
    dot: "bg-danger",
    text: "text-danger",
    ring: "border-danger/30 bg-danger/[0.07]",
  },
  cancelled: {
    dot: "bg-white/45",
    text: "text-white/65",
    ring: "border-white/15 bg-white/[0.04]",
  },
  expired: {
    dot: "bg-white/35",
    text: "text-white/55",
    ring: "border-white/10 bg-white/[0.03]",
  },
}

export function StatusPill({
  status,
  className,
}: {
  status: PaymentStatus
  className?: string
}) {
  const style = styles[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.7rem] leading-none",
        style.ring,
        style.text,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {status}
    </span>
  )
}

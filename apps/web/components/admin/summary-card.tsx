import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

type SummaryCardProps = {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  change: string
  changeTone: "positive" | "negative" | "neutral"
  /** Replaces the "Live" badge, e.g. to flag money still owed to OBH. */
  badge?: { label: string; title: string; href: string }
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  change,
  changeTone,
  badge,
}: SummaryCardProps) {
  const isPositive = changeTone === "positive"
  const isNegative = changeTone === "negative"
  const isIncrease = !change.trim().startsWith("-")
  const TrendIcon = isIncrease ? ArrowUpRight : ArrowDownRight

  return (
    <article className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        {badge ? (
          <Link
            href={badge.href}
            title={badge.title}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Badge variant="warning" className="text-[10px] tabular-nums">
              {badge.label}
            </Badge>
          </Link>
        ) : (
          <Badge variant="outline" className="text-[9px] tracking-[0.12em]">
            Live
          </Badge>
        )}
      </div>

      <p className="mt-5 text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl leading-tight font-semibold tracking-[-0.03em] whitespace-nowrap tabular-nums">
        {value}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono text-[10px] tabular-nums",
            isPositive && "text-success",
            isNegative && "text-danger",
            !isPositive && !isNegative && "text-muted-foreground"
          )}
        >
          <TrendIcon aria-hidden="true" className="size-3" />
          {change}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{hint}</span>
      </div>
    </article>
  )
}

export { SummaryCard }

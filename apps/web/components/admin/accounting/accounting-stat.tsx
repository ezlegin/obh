import type { LucideIcon } from "lucide-react"

function AccountingStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
}) {
  return (
    <article className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl leading-tight font-semibold tracking-[-0.03em] whitespace-nowrap tabular-nums">
        {value}
      </p>
      <p className="mt-3 text-[10px] leading-4 text-muted-foreground/60">
        {hint}
      </p>
    </article>
  )
}

export { AccountingStat }

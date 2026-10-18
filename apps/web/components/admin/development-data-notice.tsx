import { FlaskConical } from "lucide-react"

function DevelopmentDataNotice() {
  return (
    <div className="mt-8 flex items-start gap-4 rounded-2xl border border-warning/20 bg-warning/[0.045] p-4 sm:p-5">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-warning/20 bg-warning/10 text-warning">
        <FlaskConical aria-hidden="true" className="size-4" />
      </span>
      <div>
        <p className="font-mono text-[9px] tracking-[0.14em] text-warning uppercase">
          Development preview
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
          All financial figures, accounts, alerts, and transactions on this page
          are sample data for interface development. They are not read from the
          database and must not be treated as actual financial records.
        </p>
      </div>
    </div>
  )
}

export { DevelopmentDataNotice }

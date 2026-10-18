import { AlertTriangle, Info } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"

type AlertItem = {
  id: string
  title: string
  description: string
  severity: "warning" | "info"
}

type DashboardAlertsProps = {
  alerts: readonly AlertItem[]
}

function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Attention
          </p>
          <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">
            Needs review
          </h2>
        </div>
        <Badge variant="warning">Sample</Badge>
      </div>

      <div className="mt-4 space-y-2">
        {alerts.map((alert) => {
          const Icon = alert.severity === "warning" ? AlertTriangle : Info

          return (
            <div
              key={alert.id}
              className="rounded-xl border border-border bg-white/[0.02] p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={
                    alert.severity === "warning"
                      ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-warning/20 bg-warning/10 text-warning"
                      : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-info"
                  }
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-medium">{alert.title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-5 border-t border-border pt-4 text-[10px] leading-4 text-muted-foreground/60">
        These alerts are demonstration data. No real reconciliation is being
        reported.
      </p>
    </div>
  )
}

export { DashboardAlerts }

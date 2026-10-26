import { Badge } from "@workspace/ui/components/badge"

import { formatIrr } from "@/lib/admin/format"
import type { DashboardAccount } from "@/server/dashboard/queries"

type AccountBalancesProps = {
  accounts: readonly DashboardAccount[]
}

function AccountBalances({ accounts }: AccountBalancesProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Accounts
          </p>
          <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">
            Balance snapshot
          </h2>
        </div>
        <Badge variant="outline">{accounts.length} active</Badge>
      </div>

      <div className="mt-3 divide-y divide-border">
        {accounts.map((account) => {
          const difference = account.actualBalance - account.calculatedBalance

          return (
            <div key={account.id} className="py-5 first:pt-4 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="mt-1 font-mono text-[9px] tracking-[0.06em] text-muted-foreground/60 uppercase">
                    {account.kind} · {account.environment}
                    {account.reconciledAt
                      ? ` · Reconciled ${account.reconciledAt}`
                      : ""}
                  </p>
                </div>
                <Badge
                  variant={
                    account.kind === "Provider account" ? "info" : "outline"
                  }
                >
                  {account.kind === "Provider account"
                    ? "Provider"
                    : "Business"}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-2">
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[9px] tracking-[0.03em] text-muted-foreground/55 uppercase">
                    Actual
                  </dt>
                  <dd className="text-[11px] tabular-nums sm:mt-1">
                    {formatIrr(account.actualBalance)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[9px] tracking-[0.03em] text-muted-foreground/55 uppercase">
                    Calculated
                  </dt>
                  <dd className="text-[11px] text-muted-foreground tabular-nums sm:mt-1">
                    {formatIrr(account.calculatedBalance)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[9px] tracking-[0.03em] text-muted-foreground/55 uppercase">
                    Pending
                  </dt>
                  <dd className="text-[11px] text-warning tabular-nums sm:mt-1">
                    {formatIrr(account.pendingAmount)}
                  </dd>
                </div>
              </dl>

              {difference !== 0 ? (
                <p className="mt-3 text-[10px] leading-4 text-warning/85">
                  Reconciliation difference of {formatIrr(Math.abs(difference))}{" "}
                  against the calculated balance.
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="mt-5 border-t border-border pt-4 text-[10px] leading-4 text-muted-foreground/60">
        Actual balances reflect the latest reconciliation snapshot (or match
        calculated balances when unreconciled). Calculated balances are derived
        from verified database movements.
      </p>
    </div>
  )
}

export { AccountBalances }

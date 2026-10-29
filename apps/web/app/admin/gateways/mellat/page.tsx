import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { getMellatGatewayForAdmin } from "@/server/gateways/mellat-overview"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Mellat Gateway",
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-medium tabular-nums ${tone ?? ""}`}>
        {value}
      </p>
    </div>
  )
}

export default async function AdminMellatGatewayPage() {
  const gateway = await getMellatGatewayForAdmin()
  const { config } = gateway

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Gateways"
        title="Mellat Gateway"
        description="Read-only status of the Bank Mellat Behpardakht gateway, used for full card payments. Each payment is verified and then settled; Behpardakht only credits settled payments. Credentials live in server environment variables."
        actions={
          <Badge variant={config.liveConfigured ? "success" : "warning"}>
            {config.liveConfigured
              ? "Live credentials configured"
              : "Simulator mode (TEST)"}
          </Badge>
        }
      />

      <div className="mt-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total payments" value={gateway.stats.totalPayments} />
          <Stat
            label="Verified"
            value={gateway.stats.verifiedPayments}
            tone="text-success"
          />
          <Stat
            label="Failed"
            value={gateway.stats.failedPayments}
            tone="text-danger"
          />
          <Stat label="Pending" value={gateway.stats.pendingPayments} />
        </div>

        <section className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-medium">Configuration</h2>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Callback URL</dt>
              <dd className="mt-1 font-mono break-all">
                {gateway.callbackUrl}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Server calls</dt>
              <dd className="mt-1">
                {config.relayed
                  ? "Through the Iranian relay"
                  : "Direct to bpm.shaparak.ir (relay not set)"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Terminal ID</dt>
              <dd className="mt-1 font-mono">
                {config.terminalIdMasked ?? "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="mt-1 font-mono">
                {config.usernameMasked ?? "Not configured"}
              </dd>
            </div>
          </dl>
          {!config.liveConfigured ? (
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
              Set <code className="font-mono">BEHPARDAKHT_TERMINAL_ID</code>,{" "}
              <code className="font-mono">BEHPARDAKHT_USERNAME</code> and{" "}
              <code className="font-mono">BEHPARDAKHT_PASSWORD</code> to enable
              LIVE Mellat payments. Until then services only see Mellat in
              simulator mode.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-medium">Settlement accounts</h2>
          <ul className="mt-4 divide-y divide-border text-xs">
            {gateway.accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span>
                  {account.name}
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {account.institution}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge
                    variant={
                      account.environment === "LIVE" ? "success" : "warning"
                    }
                  >
                    {account.environment ?? "—"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {account.paymentCount} payments
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

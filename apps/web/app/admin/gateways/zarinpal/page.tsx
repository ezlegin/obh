import type { Metadata } from "next"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { getZarinpalGatewayForAdmin } from "@/server/gateways/zarinpal-overview"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Zarinpal Gateway",
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

export default async function AdminZarinpalGatewayPage() {
  const gateway = await getZarinpalGatewayForAdmin()
  const { config } = gateway

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Gateways"
        title="Zarinpal Gateway"
        description="Read-only status of the Zarinpal payment gateway, used for full card payments. Credentials live in server environment variables."
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
              <dt className="text-muted-foreground">API host</dt>
              <dd className="mt-1 font-mono break-all">
                {config.host}
                {config.sandbox ? " (sandbox)" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Callback URL</dt>
              <dd className="mt-1 font-mono break-all">
                {gateway.callbackUrl}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Merchant ID</dt>
              <dd className="mt-1 font-mono">
                {config.merchantIdMasked ?? "Not configured"}
              </dd>
            </div>
          </dl>
          {!config.liveConfigured ? (
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
              Set <code className="font-mono">ZARINPAL_MERCHANT_ID</code> to
              enable LIVE Zarinpal payments, and{" "}
              <code className="font-mono">ZARINPAL_SANDBOX=true</code> to send
              them to the Zarinpal sandbox. Until then services only see
              Zarinpal in simulator mode.
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

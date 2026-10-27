import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { getDigipayGatewayForAdmin } from "@/server/gateways/digipay-overview"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Digipay Gateway",
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

export default async function AdminDigipayGatewayPage() {
  const gateway = await getDigipayGatewayForAdmin()
  const { config } = gateway

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Gateways"
        title="Digipay Gateway"
        description="Read-only status of the Digipay Unified Payment Gateway, used for installment (BNPL / credit), wallet and card purchases. Credentials live in server environment variables."
        actions={
          <Badge variant={config.liveConfigured ? "success" : "warning"}>
            {config.liveConfigured
              ? "Live credentials configured"
              : "Simulator mode (TEST)"}
          </Badge>
        }
      />

      <div className="mt-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <Stat
            label="Installment plans"
            value={gateway.stats.installmentPlans}
          />
        </div>

        <section className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-medium">Configuration</h2>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">API base URL</dt>
              <dd className="mt-1 font-mono break-all">{config.baseUrl}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Callback URL</dt>
              <dd className="mt-1 font-mono break-all">
                {gateway.callbackUrl}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="mt-1 font-mono">
                {config.usernameMasked ?? "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Client ID</dt>
              <dd className="mt-1 font-mono">
                {config.clientIdMasked ?? "Not configured"}
              </dd>
            </div>
          </dl>
          {!config.liveConfigured ? (
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
              Set <code className="font-mono">DIGIPAY_USERNAME</code>,{" "}
              <code className="font-mono">DIGIPAY_PASSWORD</code>,{" "}
              <code className="font-mono">DIGIPAY_CLIENT_ID</code> and{" "}
              <code className="font-mono">DIGIPAY_CLIENT_SECRET</code> to enable
              LIVE Digipay payments. Until then services only see Digipay in
              simulator mode.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-5">
          <h2 className="text-sm font-medium">How installments settle</h2>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            The customer pays the first of four installments at checkout. Only
            that amount is added to the business balance right away. Digipay
            deposits each remaining installment on the 7th of the following
            Iranian months, and the balance grows on each deposit day. Track
            what is still owed on the{" "}
            <Link href="/admin/installments" className="underline">
              Installments
            </Link>{" "}
            page.
          </p>
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

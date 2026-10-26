"use client"

import {
  Check,
  Copy,
  Landmark,
  Lock,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { formatDevelopmentDate } from "@/lib/admin/format"
import type { AdminSadadGatewayOverview } from "@/server/payments/queries"

type GatewayManagerProps = {
  gateway: AdminSadadGatewayOverview
}

function GatewayManager({ gateway }: GatewayManagerProps) {
  const [copied, setCopied] = useState(false)

  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(gateway.callbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write unavailable
    }
  }

  return (
    <div className="space-y-6">
      <div className="mt-8 rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-info">
            <ShieldCheck aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium">
              Single gateway architecture · Server-side credentials only
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              OBH routes all connected service payments exclusively through{" "}
              <span className="text-foreground">{gateway.name}</span>. Gateway
              records cannot be added, edited, or deleted from the admin panel,
              and <code className="font-mono">SADAD_TERMINAL_KEY</code> never
              leaves server environment configuration.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Total payments
          </p>
          <p className="mt-2 text-2xl font-medium tabular-nums">
            {gateway.stats.totalPayments}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {gateway.stats.livePayments} LIVE · {gateway.stats.testPayments}{" "}
            TEST
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Verified (ResCode 0)
          </p>
          <p className="mt-2 text-2xl font-medium text-success tabular-nums">
            {gateway.stats.verifiedPayments}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Confirmed via Advice/Verify
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Failed / Rejected
          </p>
          <p className="mt-2 text-2xl font-medium text-danger tabular-nums">
            {gateway.stats.failedPayments}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Non-zero callback or Verify
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Pending verification
          </p>
          <p className="mt-2 text-2xl font-medium text-warning tabular-nums">
            {gateway.stats.pendingPayments}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            15-minute Sadad Verify window
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-2.5">
              <Terminal
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <div>
                <p className="text-sm font-medium">
                  Terminal &amp; environment configuration
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Read from server environment variables.
                </p>
              </div>
            </div>
            <Badge
              variant={gateway.config.liveConfigured ? "success" : "warning"}
            >
              {gateway.config.liveConfigured ? "Ready for LIVE" : "TEST only"}
            </Badge>
          </div>

          <div className="divide-y divide-border text-xs">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-muted-foreground">
                MerchantId (<code className="font-mono">SADAD_MERCHANT_ID</code>
                )
              </span>
              <span className="font-mono">
                {gateway.config.merchantIdMasked ?? "Not set"}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-muted-foreground">
                TerminalId (<code className="font-mono">SADAD_TERMINAL_ID</code>
                )
              </span>
              <span className="font-mono">
                {gateway.config.terminalIdMasked ?? "Not set"}
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-muted-foreground">
                3DES TerminalKey (
                <code className="font-mono">SADAD_TERMINAL_KEY</code>)
              </span>
              <Badge
                variant={
                  gateway.config.terminalKeyConfigured ? "success" : "muted"
                }
              >
                <Lock aria-hidden="true" className="mr-1 size-3" />
                {gateway.config.terminalKeyConfigured
                  ? "Valid Base64 key"
                  : "Not configured"}
              </Badge>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-muted-foreground">
                Local TEST simulator (
                <code className="font-mono">OBH_SADAD_SIMULATOR</code>)
              </span>
              <Badge
                variant={gateway.config.simulatorEnabled ? "warning" : "muted"}
              >
                {gateway.config.simulatorEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-2.5">
              <Server
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              <div>
                <p className="text-sm font-medium">
                  Sadad IPG endpoints &amp; callback URL
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Register this ReturnUrl and server IP with Sadad.
                </p>
              </div>
            </div>
            <Badge variant="outline">v1.10</Badge>
          </div>

          <div className="divide-y divide-border text-xs">
            <div className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  OBH callback URL (<code className="font-mono">ReturnUrl</code>
                  )
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={copyCallback}
                >
                  {copied ? (
                    <>
                      <Check aria-hidden="true" className="size-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="size-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-1.5 break-all font-mono text-[11px] text-foreground">
                {gateway.callbackUrl}
              </p>
            </div>

            <div className="px-5 py-3.5">
              <span className="text-muted-foreground">PaymentRequest API</span>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {gateway.config.requestEndpoint}
              </p>
            </div>

            <div className="px-5 py-3.5">
              <span className="text-muted-foreground">Hosted payment page</span>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {gateway.config.purchaseEndpoint}
              </p>
            </div>

            <div className="px-5 py-3.5">
              <span className="text-muted-foreground">Advice/Verify API</span>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {gateway.config.verifyEndpoint}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/40">
        <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Landmark
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <div>
              <p className="text-sm font-medium">
                Provisioned settlement accounts
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Automatically managed ledger accounts for Sadad LIVE and TEST
                payments.
              </p>
            </div>
          </div>
          <Badge variant="outline">{gateway.accounts.length} accounts</Badge>
        </div>

        <div className="divide-y divide-border">
          {gateway.accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{account.name}</p>
                  <Badge
                    variant={
                      account.environment === "TEST" ? "warning" : "success"
                    }
                  >
                    {account.environment ?? "Unknown"}
                  </Badge>
                  <Badge variant="success">Auto-provisioned</Badge>
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                  {account.currency} · {account.paymentCount} payments
                </p>
                <p className="mt-1 text-[9px] text-muted-foreground/45">
                  Created {formatDevelopmentDate(account.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { GatewayManager }

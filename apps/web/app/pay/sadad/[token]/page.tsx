import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { Logo } from "@/components/logo"
import { formatIrrDecimal } from "@/lib/admin/format"
import { getSadadSimulatorView } from "@/server/payments/api-payment-service"
import { isSadadSimulatorEnabled } from "@/server/payments/providers/registry"

export const metadata: Metadata = {
  title: "Sadad IPG Simulator",
  robots: { index: false, follow: false },
}

const statusCopy = {
  PENDING: "Awaiting cardholder confirmation",
  COMPLETED: "Verified (ResCode 0)",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
} as const

export default async function SadadSimulatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error } = await searchParams

  if (!isSadadSimulatorEnabled()) {
    notFound()
  }

  const checkout = await getSadadSimulatorView(token)

  if (!checkout) {
    notFound()
  }

  const isPending = checkout.status === "PENDING"
  const isCompleted = checkout.status === "COMPLETED"

  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Badge variant="warning">Sadad Simulator · TEST</Badge>
        </div>

        <div className="rounded-3xl border border-border bg-card/55 p-6 shadow-2xl sm:p-8">
          <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
            Sadad (Bank Melli) Hosted Payment Simulator
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            {checkout.serviceName}
          </h1>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {checkout.serviceDomain}
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-black/30 p-5">
            <p className="text-xs text-muted-foreground">Amount (IRR)</p>
            <p className="mt-2 text-3xl font-medium tracking-[-0.03em] tabular-nums">
              {formatIrrDecimal(checkout.amount)}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {checkout.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 font-mono text-[10px] text-muted-foreground/60">
              <span>{checkout.reference}</span>
              <span>OrderId: {checkout.gatewayOrderId}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">Status</span>
            <Badge
              variant={
                isCompleted
                  ? "success"
                  : checkout.status === "FAILED"
                    ? "danger"
                    : "warning"
              }
            >
              {statusCopy[checkout.status]}
            </Badge>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-xs leading-5 text-danger"
            >
              This simulated Sadad transaction could not be completed. Return to
              the service and retrieve the authoritative payment status.
            </p>
          ) : null}

          {isPending ? (
            <>
              <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
                This local page simulates Sadad&apos;s hosted payment page (
                <code className="font-mono">sadad.shaparak.ir/Purchase</code>)
                and submits an HTTP POST callback to{" "}
                <code className="font-mono">/api/v1/sadad/callback</code>, which
                then invokes Sadad <code className="font-mono">Verify</code>{" "}
                before redirecting back to the connected service.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <form action="/api/v1/sadad/callback" method="post">
                  <input
                    type="hidden"
                    name="OrderId"
                    value={checkout.gatewayOrderId}
                  />
                  <input type="hidden" name="Token" value={token} />
                  <input type="hidden" name="ResCode" value="0" />
                  <input type="hidden" name="SwitchResCode" value="0" />
                  <input
                    type="hidden"
                    name="PrimaryAccNo"
                    value="603799******1234"
                  />
                  <Button type="submit" className="w-full">
                    Simulate successful payment
                  </Button>
                </form>

                <form action="/api/v1/sadad/callback" method="post">
                  <input
                    type="hidden"
                    name="OrderId"
                    value={checkout.gatewayOrderId}
                  />
                  <input type="hidden" name="Token" value={token} />
                  <input type="hidden" name="ResCode" value="1002" />
                  <input type="hidden" name="SwitchResCode" value="-1" />
                  <Button type="submit" variant="outline" className="w-full">
                    Simulate failed / cancelled
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <p className="text-[11px] leading-5 text-muted-foreground">
                This payment is already final. The connected service should
                verify the payment through the OBH API rather than trusting this
                page.
              </p>
              {checkout.returnUrl ? (
                <Link
                  href={`${checkout.returnUrl}${checkout.returnUrl.includes("?") ? "&" : "?"}obh_reference=${encodeURIComponent(checkout.reference)}&status=${checkout.status.toLowerCase()}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "mt-4 w-full"
                  )}
                >
                  Return to service
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-[9px] tracking-[0.1em] text-muted-foreground/45 uppercase">
          OBH · Sadad IPG test simulator
        </p>
      </div>
    </main>
  )
}

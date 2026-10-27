import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { Logo } from "@/components/logo"
import { formatIrrDecimal } from "@/lib/admin/format"
import { getDigipaySimulatorView } from "@/server/payments/api-payment-service"
import { isDigipaySimulatorEnabled } from "@/server/payments/providers/registry"

export const metadata: Metadata = {
  title: "Digipay UPG Simulator",
  robots: { index: false, follow: false },
}

const statusCopy = {
  PENDING: "Awaiting customer confirmation",
  COMPLETED: "Verified",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
} as const

/** Digipay purchase `type` codes offered by the simulator. */
const simulatedPurchases = [
  { type: "13", label: "Simulate BNPL installment purchase" },
  { type: "5", label: "Simulate credit purchase" },
  { type: "11", label: "Simulate wallet purchase" },
  { type: "0", label: "Simulate card (IPG) purchase" },
] as const

export default async function DigipaySimulatorPage({
  params,
}: {
  params: Promise<{ ticket: string }>
}) {
  const { ticket } = await params

  if (!isDigipaySimulatorEnabled()) {
    notFound()
  }

  const checkout = await getDigipaySimulatorView(ticket)

  if (!checkout) {
    return (
      <main
        id="main-content"
        className="flex min-h-dvh items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-lg">
          <div className="mb-8 flex items-center justify-between">
            <Logo />
            <Badge variant="warning">Digipay Simulator · TEST</Badge>
          </div>

          <div className="rounded-3xl border border-border bg-card/55 p-6 shadow-2xl sm:p-8">
            <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
              Digipay Unified Payment Gateway Simulator
            </p>
            <h1 className="mt-3 text-2xl font-medium tracking-[-0.03em]">
              Payment session not found
            </h1>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              No active <code className="font-mono">TEST</code> Digipay payment
              matches ticket{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-foreground">
                {ticket}
              </code>
              . Create a payment via{" "}
              <code className="font-mono">POST /api/v1/payments</code> with{" "}
              <code className="font-mono">gateway: &quot;digipay&quot;</code>{" "}
              and open the returned{" "}
              <code className="font-mono">checkoutUrl</code>.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const isPending = checkout.status === "PENDING"
  const isCompleted = checkout.status === "COMPLETED"
  const trackingCode = `sim${checkout.gatewayOrderId}${Date.now().toString().slice(-8)}`

  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Badge variant="warning">Digipay Simulator · TEST</Badge>
        </div>

        <div className="rounded-3xl border border-border bg-card/55 p-6 shadow-2xl sm:p-8">
          <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
            Digipay Unified Payment Gateway Simulator
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            {checkout.serviceName}
          </h1>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {checkout.serviceDomain}
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-black/30 p-5">
            <p className="text-xs text-muted-foreground">Amount (R)</p>
            <p className="mt-2 text-3xl font-medium tracking-[-0.03em] tabular-nums">
              {formatIrrDecimal(checkout.amount)}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {checkout.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 font-mono text-[10px] text-muted-foreground/60">
              <span>{checkout.reference}</span>
              <span>providerId: {checkout.gatewayOrderId}</span>
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

          {isPending ? (
            <>
              <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
                This local page simulates Digipay&apos;s hosted payment page and
                posts the payment result to{" "}
                <code className="font-mono">/api/v1/digipay/callback</code>,
                which then runs Digipay{" "}
                <code className="font-mono">purchases/verify</code> before
                redirecting back to the connected service.
              </p>
              <div className="mt-5 grid gap-2">
                {simulatedPurchases.map((purchase, index) => (
                  <form
                    key={purchase.type}
                    action="/api/v1/digipay/callback"
                    method="post"
                  >
                    <input type="hidden" name="result" value="SUCCESS" />
                    <input
                      type="hidden"
                      name="providerId"
                      value={checkout.gatewayOrderId}
                    />
                    <input
                      type="hidden"
                      name="amount"
                      value={checkout.amount}
                    />
                    <input
                      type="hidden"
                      name="trackingCode"
                      value={trackingCode}
                    />
                    <input type="hidden" name="type" value={purchase.type} />
                    <input
                      type="hidden"
                      name="isCredit"
                      value={String(
                        purchase.type === "5" || purchase.type === "13"
                      )}
                    />
                    <button
                      type="submit"
                      className={cn(
                        buttonVariants({
                          variant: index === 0 ? "default" : "outline",
                        }),
                        "w-full"
                      )}
                    >
                      {purchase.label}
                    </button>
                  </form>
                ))}

                <form action="/api/v1/digipay/callback" method="post">
                  <input type="hidden" name="result" value="FAILURE" />
                  <input
                    type="hidden"
                    name="providerId"
                    value={checkout.gatewayOrderId}
                  />
                  <input type="hidden" name="amount" value={checkout.amount} />
                  <input
                    type="hidden"
                    name="trackingCode"
                    value={trackingCode}
                  />
                  <input type="hidden" name="type" value="13" />
                  <button
                    type="submit"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full"
                    )}
                  >
                    Simulate failed / cancelled
                  </button>
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
          OBH · Digipay UPG test simulator
        </p>
      </div>
    </main>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { Logo } from "@/components/logo"
import { getDevelopmentCheckoutView } from "@/server/payments/api-payment-service"
import { isDevelopmentProviderEnabled } from "@/server/payments/providers/development"
import { formatIrrDecimal } from "@/lib/admin/format"

export const metadata: Metadata = {
  title: "Development checkout",
  robots: { index: false, follow: false },
}

const statusCopy = {
  PENDING: "Awaiting result",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
} as const

export default async function DevelopmentCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error } = await searchParams

  if (!isDevelopmentProviderEnabled()) {
    notFound()
  }

  const checkout = await getDevelopmentCheckoutView(token)

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
          <Badge variant="warning">Test mode</Badge>
        </div>

        <div className="rounded-3xl border border-border bg-card/55 p-6 shadow-2xl sm:p-8">
          <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/60 uppercase">
            Development checkout · No real money
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            {checkout.serviceName}
          </h1>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {checkout.serviceDomain}
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-black/30 p-5">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="mt-2 text-3xl font-medium tracking-[-0.03em] tabular-nums">
              {formatIrrDecimal(checkout.amount)}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {checkout.description}
            </p>
            <p className="mt-4 border-t border-border pt-4 font-mono text-[10px] text-muted-foreground/60">
              {checkout.reference}
            </p>
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
              This development checkout could not be completed. Return to the
              service and retrieve the authoritative payment status.
            </p>
          ) : null}

          {isPending ? (
            <>
              <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
                This page simulates the provider&apos;s checkout result. The
                development adapter is local-only and this payment is stored in
                TEST environment. A browser redirect alone is not proof of
                payment; the connected service must retrieve the payment through
                the API.
              </p>
              <form
                action={`/pay/dev/${token}/complete`}
                method="post"
                className="mt-5 grid gap-2 sm:grid-cols-2"
              >
                <Button type="submit" name="outcome" value="success">
                  Simulate success
                </Button>
                <Button
                  type="submit"
                  name="outcome"
                  value="failure"
                  variant="outline"
                >
                  Simulate failure
                </Button>
              </form>
            </>
          ) : (
            <div className="mt-6">
              <p className="text-[11px] leading-5 text-muted-foreground">
                This payment is already final. No further provider action is
                possible. The connected service should verify the payment
                through the API rather than trusting this page.
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
          OBH development environment
        </p>
      </div>
    </main>
  )
}

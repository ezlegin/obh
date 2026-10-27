"use client"

import { Check, Copy, ExternalLink, Loader2, Trash2 } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge"
import {
  formatDevelopmentDateTime,
  formatIrrDecimal,
} from "@/lib/admin/format"
import type { AdminPayment } from "@/server/payments/queries"

type PaymentDetailDialogProps = {
  payment: AdminPayment | null
  onOpenChange: (open: boolean) => void
  onSimulate?: (payment: AdminPayment) => void
  onDelete?: (payment: AdminPayment) => void
  deleting?: boolean
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground/60 uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-all text-xs text-foreground sm:text-right">
        {value}
      </dd>
    </div>
  )
}

function PaymentDetailDialog({
  payment,
  onOpenChange,
  onSimulate,
  onDelete,
  deleting,
}: PaymentDetailDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!payment) {
    return null
  }

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(key)
      window.setTimeout(() => setCopiedField(null), 1600)
    } catch {
      // Clipboard may be unavailable in insecure contexts.
    }
  }

  return (
    <AdminDialog
      open
      onOpenChange={onOpenChange}
      title={payment.reference}
      description="Complete payment record, Sadad gateway receipt, and lifecycle history."
      className="max-w-2xl"
    >
      <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-1">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={payment.status} />
            <Badge
              variant={payment.environment === "TEST" ? "warning" : "success"}
            >
              {payment.environment}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => copyValue("reference", payment.reference)}
            >
              {copiedField === "reference" ? (
                <Check aria-hidden="true" className="size-3" />
              ) : (
                <Copy aria-hidden="true" className="size-3" />
              )}
              {copiedField === "reference" ? "Copied" : "Copy reference"}
            </Button>
          </div>

          <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] tabular-nums">
            {formatIrrDecimal(payment.amount)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {payment.description}
          </p>
        </div>

        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Identifiers &amp; routing
          </p>
          <dl className="mt-2 rounded-xl border border-border bg-white/[0.02] px-4 py-1">
            <DetailRow
              label="Payment ID"
              value={<span className="font-mono">{payment.id}</span>}
            />
            <DetailRow
              label="OBH Reference"
              value={<span className="font-mono">{payment.reference}</span>}
            />
            <DetailRow
              label="Connected Service"
              value={
                payment.serviceName
                  ? `${payment.serviceName}${payment.serviceDomain ? ` (${payment.serviceDomain})` : ""}`
                  : "—"
              }
            />
            <DetailRow
              label="External Order ID"
              value={
                <span className="font-mono">
                  {payment.externalOrderId ?? "—"}
                </span>
              }
            />
            <DetailRow
              label="Idempotency Key"
              value={
                <span className="font-mono">
                  {payment.idempotencyKey ?? "—"}
                </span>
              }
            />
            <DetailRow
              label="Return URL"
              value={
                payment.returnUrl ? (
                  <span className="font-mono">{payment.returnUrl}</span>
                ) : (
                  "—"
                )
              }
            />
            {payment.checkoutUrl ? (
              <DetailRow
                label="Checkout URL"
                value={
                  <a
                    href={payment.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-info underline underline-offset-4"
                  >
                    <span className="max-w-xs truncate">
                      {payment.checkoutUrl}
                    </span>
                    <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
                  </a>
                }
              />
            ) : null}
          </dl>
        </div>

        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Sadad gateway receipt
          </p>
          <dl className="mt-2 rounded-xl border border-border bg-white/[0.02] px-4 py-1">
            <DetailRow
              label="Provider"
              value={payment.providerName ?? "Sadad (Bank Melli Iran)"}
            />
            <DetailRow
              label="Provider Account"
              value={payment.providerAccountName ?? "—"}
            />
            <DetailRow
              label="Sadad OrderId"
              value={
                <span className="font-mono">{payment.gatewayOrderId}</span>
              }
            />
            <DetailRow
              label="Token / Session"
              value={
                <span className="font-mono">
                  {payment.providerSessionId ?? "—"}
                </span>
              }
            />
            <DetailRow
              label="Trace Number (SystemTraceNo)"
              value={
                <span className="font-mono">{payment.traceNumber ?? "—"}</span>
              }
            />
            <DetailRow
              label="Reference Number (RetrivalRefNo)"
              value={
                <span className="font-mono">
                  {payment.providerReference ?? "—"}
                </span>
              }
            />
            <DetailRow
              label="Masked Card"
              value={
                <span className="font-mono">
                  {payment.maskedCardNumber ?? "—"}
                </span>
              }
            />
            <DetailRow
              label="Gateway ResCode"
              value={
                <span className="font-mono">
                  {payment.gatewayResultCode !== null
                    ? String(payment.gatewayResultCode)
                    : "—"}
                </span>
              }
            />
            <DetailRow
              label="Gateway Message"
              value={payment.gatewayResultText ?? "—"}
            />
          </dl>
        </div>

        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Timestamps
          </p>
          <dl className="mt-2 rounded-xl border border-border bg-white/[0.02] px-4 py-1">
            <DetailRow
              label="Created"
              value={formatDevelopmentDateTime(payment.createdAt)}
            />
            <DetailRow
              label="Callback Received"
              value={
                payment.callbackReceivedAt
                  ? formatDevelopmentDateTime(payment.callbackReceivedAt)
                  : "—"
              }
            />
            <DetailRow
              label="Completed"
              value={
                payment.paidAt
                  ? formatDevelopmentDateTime(payment.paidAt)
                  : "—"
              }
            />
            <DetailRow
              label="Verified"
              value={
                payment.verifiedAt
                  ? formatDevelopmentDateTime(payment.verifiedAt)
                  : "Awaiting verification"
              }
            />
            {payment.failedAt ? (
              <DetailRow
                label="Failed"
                value={formatDevelopmentDateTime(payment.failedAt)}
              />
            ) : null}
            {payment.cancelledAt ? (
              <DetailRow
                label="Cancelled"
                value={formatDevelopmentDateTime(payment.cancelledAt)}
              />
            ) : null}
          </dl>
        </div>

        {payment.metadata && Object.keys(payment.metadata).length > 0 ? (
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Metadata
            </p>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
              {JSON.stringify(payment.metadata, null, 2)}
            </pre>
          </div>
        ) : null}

        {payment.verifications.length > 0 ? (
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Verification attempts ({payment.verifications.length})
            </p>
            <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-white/[0.02]">
              {payment.verifications.map((v) => (
                <div key={v.id} className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          v.status === "VERIFIED"
                            ? "success"
                            : v.status === "FAILED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {v.status}
                      </Badge>
                      <span className="font-mono text-[11px]">{v.method}</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatDevelopmentDateTime(v.createdAt)}
                    </span>
                  </div>
                  {v.providerReference ? (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      RetrivalRefNo: {v.providerReference}
                    </p>
                  ) : null}
                  {v.failureReason ? (
                    <p className="mt-1 text-[11px] text-danger">
                      {v.failureReason}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {payment.events.length > 0 ? (
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Lifecycle events ({payment.eventCount})
            </p>
            <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-white/[0.02]">
              {payment.events.map((event) => (
                <div key={event.id} className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-medium">
                        {event.type}
                      </span>
                      <Badge variant="outline">{event.source}</Badge>
                      {event.previousStatus || event.newStatus ? (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {event.previousStatus ?? "—"} →{" "}
                          {event.newStatus ?? "—"}
                        </span>
                      ) : null}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatDevelopmentDateTime(event.createdAt)}
                    </span>
                  </div>
                  {event.message ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {event.message}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {payment.status === "PENDING" && payment.checkoutUrl ? (
            <a
              href={payment.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "default" })}
            >
              Open Sadad Checkout
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
          {payment.status === "PENDING" &&
          payment.environment === "TEST" &&
          onSimulate ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onSimulate(payment)
              }}
            >
              Simulate result
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(payment)}
              disabled={deleting}
              className="text-danger hover:bg-danger/10 hover:text-danger"
            >
              {deleting ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="size-3.5" />
              )}
              Remove payment
            </Button>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </AdminDialog>
  )
}

export { PaymentDetailDialog }

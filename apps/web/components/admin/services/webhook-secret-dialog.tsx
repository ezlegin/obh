"use client"

import { Check, Copy, ShieldAlert } from "lucide-react"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { formatDevelopmentDate } from "@/lib/admin/format"

export type IssuedWebhookSecret = {
  secret: string
  serviceName: string
  createdAt: string
}

type WebhookSecretDialogProps = {
  data: IssuedWebhookSecret | null
  onClose: () => void
}

function WebhookSecretDialog({ data, onClose }: WebhookSecretDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!data) {
    return null
  }

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(data.secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <AdminDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title="Webhook signing secret"
      description="Store this secret in the connected service's server-side environment. It is shown once and cannot be recovered."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Test</Badge>
        <Badge variant="outline">{data.serviceName}</Badge>
        <span className="font-mono text-[9px] text-muted-foreground">
          {formatDevelopmentDate(data.createdAt)}
        </span>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-black p-4">
        <code className="block font-mono text-[11px] leading-5 break-all text-foreground">
          {data.secret}
        </code>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
        <ShieldAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <p className="text-[11px] leading-5 text-muted-foreground">
          Rotating the secret immediately invalidates deliveries signed with the
          previous value. This secret is separate from the service API
          credential.
        </p>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          I have saved it
        </Button>
        <Button onClick={copySecret}>
          {copied ? (
            <>
              <Check aria-hidden="true" className="size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="size-4" />
              Copy secret
            </>
          )}
        </Button>
      </div>
    </AdminDialog>
  )
}

export { WebhookSecretDialog }

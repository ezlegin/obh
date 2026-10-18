"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AdminDialog } from "@/components/admin/admin-dialog"
import type { IssuedCredential } from "@/components/admin/services/issue-credential-dialog"

type CredentialSecretDialogProps = {
  credential: IssuedCredential | null
  onClose: () => void
}

function CredentialSecretDialog({
  credential,
  onClose,
}: CredentialSecretDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!credential) {
    return null
  }

  const copyCredential = async () => {
    try {
      await navigator.clipboard.writeText(credential.presentedKey)
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
      title="Credential issued"
      description="Copy this credential now. It will not be shown again and cannot be recovered."
    >
      <div className="flex items-center gap-2">
        <Badge variant="warning">Test</Badge>
        <Badge variant="outline">{credential.label}</Badge>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-black p-4">
        <code className="block font-mono text-[11px] leading-5 break-all text-foreground">
          {credential.presentedKey}
        </code>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Store it in the connected service&apos;s server-side environment. Never
        put this key in browser code or a public repository.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          I have saved it
        </Button>
        <Button onClick={copyCredential}>
          {copied ? (
            <>
              <Check aria-hidden="true" className="size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="size-4" />
              Copy credential
            </>
          )}
        </Button>
      </div>
    </AdminDialog>
  )
}

export { CredentialSecretDialog }

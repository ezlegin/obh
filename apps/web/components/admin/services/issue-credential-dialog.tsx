"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, Loader2, ShieldAlert } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { issueServiceCredentialAction } from "@/app/admin/services/actions"
import type { AdminConnectedService } from "@/server/payments/queries"

const credentialSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Label must be at least 2 characters.")
    .max(120),
  environment: z.enum(["TEST", "LIVE"]),
})

type CredentialValues = z.infer<typeof credentialSchema>

type IssuedCredential = {
  presentedKey: string
  keyId: string
  label: string
  environment: "TEST" | "LIVE"
  createdAt: string
}

type IssueCredentialDialogProps = {
  service: AdminConnectedService | null
  onOpenChange: (open: boolean) => void
  onIssued: (credential: IssuedCredential) => void
}

function IssueCredentialDialog({
  service,
  onOpenChange,
  onIssued,
}: IssueCredentialDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CredentialValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: { label: "Primary key", environment: "TEST" },
  })

  useEffect(() => {
    if (service) {
      setServerError(null)
      reset({ label: "Primary key", environment: "TEST" })
    }
  }, [service, reset])

  if (!service) {
    return null
  }

  const onSubmit = (values: CredentialValues) => {
    setServerError(null)

    startTransition(async () => {
      const result = await issueServiceCredentialAction({
        serviceId: service.id,
        label: values.label,
        environment: values.environment,
      })

      if (!result.ok || !result.presentedKey || !result.credential) {
        setServerError(result.error ?? "The credential could not be issued.")
        return
      }

      onIssued({
        presentedKey: result.presentedKey,
        keyId: result.credential.keyId,
        label: result.credential.label,
        environment: result.credential.environment,
        createdAt: result.credential.createdAt,
      })
      onOpenChange(false)
    })
  }

  return (
    <AdminDialog
      open
      onOpenChange={onOpenChange}
      title={`Issue credential · ${service.name}`}
      description="The raw credential is shown exactly once. OBH stores only a SHA-256 hash of the secret."
    >
      <div className="rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            <code className="font-mono">TEST</code> credentials route to the
            Sadad simulator; <code className="font-mono">LIVE</code> credentials
            route to the real Sadad terminal configured in server environment
            variables.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="credential-label">Label</Label>
          <Input
            id="credential-label"
            placeholder="Primary key"
            aria-invalid={Boolean(errors.label)}
            {...register("label")}
          />
          {errors.label ? (
            <p className="text-xs text-danger">{errors.label.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="credential-environment">Environment</Label>
          <div className="relative">
            <NativeSelect
              id="credential-environment"
              {...register("environment")}
            >
              <option value="TEST">TEST · Sadad simulator</option>
              <option value="LIVE">LIVE · Real Sadad IPG</option>
            </NativeSelect>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>

        {serverError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-xs leading-5 text-danger"
          >
            {serverError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Issuing…
              </>
            ) : (
              "Issue credential"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { IssueCredentialDialog }
export type { IssuedCredential }

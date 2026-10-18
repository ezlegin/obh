"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Landmark,
  Loader2,
  Plus,
  Power,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { AdminEmptyState } from "@/components/admin/empty-state"
import {
  createProviderAccountAction,
  enableDevelopmentProviderAction,
  toggleProviderAccountAction,
} from "@/app/admin/gateways/actions"
import type {
  AdminPaymentProvider,
  AdminProviderAccount,
} from "@/server/payments/queries"
import { formatDevelopmentDate } from "@/lib/admin/format"

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(160),
  externalReference: z.string().trim().max(191),
})

type AccountValues = z.infer<typeof accountSchema>

type GatewayManagerProps = {
  providers: AdminPaymentProvider[]
}

function CreateAccountDialog({
  provider,
  open,
  onOpenChange,
  onCreated,
}: {
  provider: AdminPaymentProvider
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", externalReference: "" },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset()
    }
  }, [open, reset])

  const onSubmit = (values: AccountValues) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createProviderAccountAction({
        providerId: provider.id,
        name: values.name,
        externalReference: values.externalReference,
      })

      if (!result.ok) {
        setServerError(result.error ?? "The account could not be created.")
        return
      }

      onOpenChange(false)
      onCreated()
    })
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a test provider account"
      description="This creates an internal OBH account record for the development adapter. It does not connect to a real payment provider or contain real funds."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="provider-account-name">Account name</Label>
          <Input
            id="provider-account-name"
            placeholder="Development acquiring account"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs text-danger">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider-account-reference">Provider reference</Label>
          <Input
            id="provider-account-reference"
            placeholder="Optional external or merchant reference"
            {...register("externalReference")}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-white/[0.025] px-4 py-3">
          <span className="text-xs text-muted-foreground">Environment</span>
          <Badge variant="warning">Test</Badge>
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
                Creating…
              </>
            ) : (
              "Create test account"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

function ProviderAccountRow({
  account,
  pending,
  onToggle,
}: {
  account: AdminProviderAccount
  pending: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{account.name}</p>
          <Badge
            variant={account.environment === "TEST" ? "warning" : "success"}
          >
            {account.environment ?? "Unknown"}
          </Badge>
          <Badge variant={account.isActive ? "success" : "muted"}>
            {account.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
          {account.currency} · {account.paymentCount} payments
          {account.externalReference ? ` · ${account.externalReference}` : ""}
        </p>
        <p className="mt-1 text-[9px] text-muted-foreground/45">
          Created {formatDevelopmentDate(account.createdAt)}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggle}
        disabled={pending}
        className="self-start sm:self-auto"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <Power aria-hidden="true" className="size-3.5" />
        )}
        {account.isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  )
}

function GatewayManager({ providers }: GatewayManagerProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isEnabling, startEnabling] = useTransition()
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [pendingAccount, setPendingAccount] = useState<string | null>(null)

  const developmentProvider = providers.find(
    (provider) => provider.code === "development"
  )

  const refresh = () => router.refresh()

  const enableProvider = () => {
    setError(null)
    startEnabling(async () => {
      const result = await enableDevelopmentProviderAction()
      if (!result.ok) {
        setError(result.error ?? "The provider could not be enabled.")
        return
      }
      refresh()
    })
  }

  const toggleAccount = async (account: AdminProviderAccount) => {
    setPendingAccount(account.id)
    setError(null)

    const result = await toggleProviderAccountAction({
      accountId: account.id,
      isActive: !account.isActive,
    })

    if (!result.ok) {
      setError(result.error ?? "The account status could not be changed.")
    } else {
      refresh()
    }

    setPendingAccount(null)
  }

  return (
    <>
      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-info">
            <ShieldCheck aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium">
              Provider secrets stay outside the database
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Only the development adapter is available in this step. Real
              provider credentials must remain in server-side environment or
              secret-manager configuration; they are never entered into OBH
              admin records.
            </p>
          </div>
        </div>
      </div>

      {!developmentProvider ? (
        <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/[0.035]">
          <AdminEmptyState
            icon={TriangleAlert}
            title="No gateway provider is enabled"
            description="Enable the local development gateway to create test provider accounts and exercise payment lifecycles. No real payment network is contacted."
            action={
              <Button
                type="button"
                onClick={enableProvider}
                disabled={isEnabling}
              >
                {isEnabling ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Plus aria-hidden="true" className="size-4" />
                )}
                Enable development gateway
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
                Providers
              </p>
              <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">
                {developmentProvider.name}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Development adapter · TEST</Badge>
              <Badge
                variant={developmentProvider.isActive ? "success" : "muted"}
              >
                {developmentProvider.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card/40">
            <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">Provider accounts</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Internal account records for TEST payments only.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAccountDialogOpen(true)}
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Add test account
              </Button>
            </div>

            {developmentProvider.accounts.length === 0 ? (
              <AdminEmptyState
                icon={Landmark}
                title="No provider account yet"
                description="Create a TEST provider account before initiating a development payment."
                className="py-12"
              />
            ) : (
              <div>
                {developmentProvider.accounts.map((account) => (
                  <ProviderAccountRow
                    key={account.id}
                    account={account}
                    pending={pendingAccount === account.id}
                    onToggle={() => toggleAccount(account)}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-[10px] leading-5 text-muted-foreground/55">
            Provider balances, settlements, fees, and reconciliation are modeled
            in the database but their management workflows will be implemented
            in a later gateway step.
          </p>

          <CreateAccountDialog
            provider={developmentProvider}
            open={isAccountDialogOpen}
            onOpenChange={setIsAccountDialogOpen}
            onCreated={refresh}
          />
        </>
      )}
    </>
  )
}

export { GatewayManager }

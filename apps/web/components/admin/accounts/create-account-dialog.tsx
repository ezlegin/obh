"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { createBusinessAccountAction } from "@/app/admin/accounts/actions"
import {
  createBusinessAccountSchema,
  type CreateBusinessAccountInput,
} from "@/lib/validation/accounting"
import { todayInputValue } from "@/lib/admin/format"

function CreateBusinessAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: {
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
  } = useForm<CreateBusinessAccountInput>({
    resolver: zodResolver(createBusinessAccountSchema),
    defaultValues: {
      name: "",
      institution: "",
      maskedIdentifier: "",
      openingBalance: "0",
      openingBalanceAt: todayInputValue(),
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset({
        name: "",
        institution: "",
        maskedIdentifier: "",
        openingBalance: "0",
        openingBalanceAt: todayInputValue(),
        notes: "",
      })
    }
  }, [open, reset])

  const onSubmit = (values: CreateBusinessAccountInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createBusinessAccountAction(values)

      if (!result.ok) {
        setServerError(
          result.error ?? "The payment source could not be created."
        )
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
      title="Add a business payment source"
      description="Business-owned accounts are used for income and expense records. They are separate from gateway provider accounts."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              placeholder="Main operating account"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-danger">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-institution">Institution</Label>
            <Input
              id="account-institution"
              placeholder="Bank or cash location"
              {...register("institution")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-identifier">Masked identifier</Label>
          <Input
            id="account-identifier"
            placeholder="•••• 4821"
            {...register("maskedIdentifier")}
          />
          <p className="text-[10px] leading-4 text-muted-foreground/60">
            Never enter a full card number, IBAN, or account credential.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account-opening-balance">
              Opening balance (R)
            </Label>
            <Input
              id="account-opening-balance"
              inputMode="decimal"
              aria-invalid={Boolean(errors.openingBalance)}
              {...register("openingBalance")}
            />
            {errors.openingBalance ? (
              <p className="text-xs text-danger">
                {errors.openingBalance.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-opening-date">Opening balance date</Label>
            <Input
              id="account-opening-date"
              type="date"
              {...register("openingBalanceAt")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-notes">Notes</Label>
          <Textarea id="account-notes" {...register("notes")} />
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
              "Add payment source"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { CreateBusinessAccountDialog }

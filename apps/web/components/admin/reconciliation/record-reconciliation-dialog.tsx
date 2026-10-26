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
import { AmountInput } from "@/components/admin/amount-input"
import { recordReconciliationAction } from "@/app/admin/reconciliation/actions"
import { updateReconciliationAction } from "@/app/admin/reconciliation/edit-actions"
import type {
  ProviderAccountBalanceView,
  ReconciliationView,
} from "@/server/reconciliation/queries"
import {
  recordReconciliationSchema,
  type RecordReconciliationInput,
} from "@/lib/validation/reconciliation"
import { formatIrrDecimal, todayInputValue } from "@/lib/admin/format"

function getReconciliationDefaults(
  account: ProviderAccountBalanceView | null,
  reconciliation: ReconciliationView | null | undefined
): RecordReconciliationInput {
  if (reconciliation) {
    return {
      accountId: reconciliation.accountId,
      actualBalance: reconciliation.actualBalance.replace(/\.00$/, ""),
      asOf: reconciliation.asOf,
      note: reconciliation.note ?? "",
    }
  }

  return {
    accountId: account?.id ?? "",
    actualBalance: "",
    asOf: todayInputValue(),
    note: "",
  }
}

function RecordReconciliationDialog({
  account,
  reconciliation,
  open,
  onOpenChange,
  onCreated,
}: {
  account: ProviderAccountBalanceView | null
  reconciliation?: ReconciliationView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isEditing = Boolean(reconciliation)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordReconciliationInput>({
    resolver: zodResolver(recordReconciliationSchema),
    defaultValues: getReconciliationDefaults(account, null),
  })

  useEffect(() => {
    if (open && account) {
      setServerError(null)
      reset(getReconciliationDefaults(account, reconciliation))
    }
  }, [open, account, reconciliation, reset])

  if (!account) {
    return null
  }

  const onSubmit = (values: RecordReconciliationInput) => {
    setServerError(null)

    startTransition(async () => {
      if (reconciliation) {
        const result = await updateReconciliationAction({
          ...values,
          reconciliationId: reconciliation.id,
        })

        if (!result.ok) {
          setServerError(
            result.error ?? "The reconciliation could not be updated."
          )
          return
        }

        onOpenChange(false)
        onCreated()
        return
      }

      const result = await recordReconciliationAction(values)

      if (!result.ok) {
        setServerError(
          result.error ?? "The reconciliation could not be recorded."
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
      title={`${isEditing ? "Edit" : "Reconcile"} · ${account.name}`}
      description={
        isEditing
          ? "Update the actual balance for this reconciliation. The calculated balance and difference are recalculated and the change is audited."
          : "Enter the actual balance from the provider statement. OBH compares it with the calculated balance from recorded payments, settled fees, and completed transfers."
      }
    >
      <div className="rounded-xl border border-border bg-white/[0.02] p-4">
        <p className="text-[10px] text-muted-foreground">Calculated balance</p>
        <p className="mt-1 text-xl font-medium tabular-nums">
          {formatIrrDecimal(account.calculatedBalance)}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-5"
      >
        <input type="hidden" {...register("accountId")} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="actual-balance">
              Actual balance ({account.currency})
            </Label>
            <AmountInput
              id="actual-balance"
              control={control}
              name="actualBalance"
              allowNegative
              ariaInvalid={Boolean(errors.actualBalance)}
            />
            {errors.actualBalance ? (
              <p className="text-xs text-danger">
                {errors.actualBalance.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reconciliation-date">As of</Label>
            <Input id="reconciliation-date" type="date" {...register("asOf")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reconciliation-note">Note</Label>
          <Textarea
            id="reconciliation-note"
            placeholder="Source of the actual balance"
            {...register("note")}
          />
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
                {isEditing ? "Saving…" : "Recording…"}
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Record reconciliation"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { RecordReconciliationDialog }

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { AmountInput } from "@/components/admin/amount-input"
import { recordSettlementAction } from "@/app/admin/reconciliation/actions"
import { updateSettlementAction } from "@/app/admin/reconciliation/edit-actions"
import type {
  ProviderAccountBalanceView,
  SettlementView,
} from "@/server/reconciliation/queries"
import {
  recordSettlementSchema,
  type RecordSettlementInput,
} from "@/lib/validation/reconciliation"
import { todayInputValue } from "@/lib/admin/format"

function getSettlementDefaults(
  account: ProviderAccountBalanceView | null,
  businessAccounts: Array<{ id: string }>,
  settlement: SettlementView | null | undefined
): RecordSettlementInput {
  if (settlement) {
    return {
      providerAccountId: settlement.fromAccountId,
      toAccountId: settlement.toAccountId,
      amount: settlement.amount.replace(/\.00$/, ""),
      occurredAt: settlement.occurredAt,
      externalReference: settlement.externalReference ?? "",
      note: settlement.note ?? "",
    }
  }

  return {
    providerAccountId: account?.id ?? "",
    toAccountId: businessAccounts[0]?.id ?? "",
    amount: "",
    occurredAt: todayInputValue(),
    externalReference: "",
    note: "",
  }
}

function RecordSettlementDialog({
  account,
  businessAccounts,
  settlement,
  open,
  onOpenChange,
  onCreated,
}: {
  account: ProviderAccountBalanceView | null
  businessAccounts: Array<{ id: string; name: string }>
  settlement?: SettlementView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isEditing = Boolean(settlement)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordSettlementInput>({
    resolver: zodResolver(recordSettlementSchema),
    defaultValues: getSettlementDefaults(account, businessAccounts, null),
  })

  useEffect(() => {
    if (open && account) {
      setServerError(null)
      reset(getSettlementDefaults(account, businessAccounts, settlement))
    }
  }, [open, account, businessAccounts, settlement, reset])

  if (!account) {
    return null
  }

  const onSubmit = (values: RecordSettlementInput) => {
    setServerError(null)

    startTransition(async () => {
      if (settlement) {
        const result = await updateSettlementAction({
          ...values,
          transferId: settlement.id,
        })

        if (!result.ok) {
          setServerError(result.error ?? "The settlement could not be updated.")
          return
        }

        onOpenChange(false)
        onCreated()
        return
      }

      const result = await recordSettlementAction(values)

      if (!result.ok) {
        setServerError(result.error ?? "The settlement could not be recorded.")
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
      title={`${isEditing ? "Edit" : "Record"} settlement · ${account.name}`}
      description={
        isEditing
          ? "Update the settlement record. Changes are recorded in the audit log."
          : "Records a completed settlement transfer from the provider account to a business payment source. This is an accounting record; no bank transfer is executed."
      }
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <input type="hidden" {...register("providerAccountId")} />

        <div className="space-y-2">
          <Label htmlFor="settlement-target">Business account</Label>
          <NativeSelect id="settlement-target" {...register("toAccountId")}>
            {businessAccounts.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </NativeSelect>
          {businessAccounts.length === 0 ? (
            <p className="text-[10px] text-warning">
              Add an active business payment source first.
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settlement-amount">
              Amount ({account.currency})
            </Label>
            <AmountInput
              id="settlement-amount"
              control={control}
              name="amount"
              ariaInvalid={Boolean(errors.amount)}
            />
            {errors.amount ? (
              <p className="text-xs text-danger">{errors.amount.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="settlement-date">Settled on</Label>
            <Input
              id="settlement-date"
              type="date"
              {...register("occurredAt")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settlement-reference">
            Bank / provider reference
          </Label>
          <Input id="settlement-reference" {...register("externalReference")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settlement-note">Note</Label>
          <Textarea id="settlement-note" {...register("note")} />
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
          <Button
            type="submit"
            disabled={isPending || businessAccounts.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {isEditing ? "Saving…" : "Recording…"}
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Record settlement"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { RecordSettlementDialog }

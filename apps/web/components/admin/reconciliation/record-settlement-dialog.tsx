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
import { recordSettlementAction } from "@/app/admin/reconciliation/actions"
import type { ProviderAccountBalanceView } from "@/server/reconciliation/queries"
import {
  recordSettlementSchema,
  type RecordSettlementInput,
} from "@/lib/validation/reconciliation"
import { todayInputValue } from "@/lib/admin/format"

function RecordSettlementDialog({
  account,
  businessAccounts,
  open,
  onOpenChange,
  onCreated,
}: {
  account: ProviderAccountBalanceView | null
  businessAccounts: Array<{ id: string; name: string }>
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
  } = useForm<RecordSettlementInput>({
    resolver: zodResolver(recordSettlementSchema),
    defaultValues: {
      providerAccountId: account?.id ?? "",
      toAccountId: businessAccounts[0]?.id ?? "",
      amount: "",
      occurredAt: todayInputValue(),
      externalReference: "",
      note: "",
    },
  })

  useEffect(() => {
    if (open && account) {
      setServerError(null)
      reset({
        providerAccountId: account.id,
        toAccountId: businessAccounts[0]?.id ?? "",
        amount: "",
        occurredAt: todayInputValue(),
        externalReference: "",
        note: "",
      })
    }
  }, [open, account, businessAccounts, reset])

  if (!account) {
    return null
  }

  const onSubmit = (values: RecordSettlementInput) => {
    setServerError(null)

    startTransition(async () => {
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
      title={`Record settlement · ${account.name}`}
      description="Records a completed settlement transfer from the provider account to a business payment source. This is an accounting record; no bank transfer is executed."
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
            <Input
              id="settlement-amount"
              inputMode="decimal"
              aria-invalid={Boolean(errors.amount)}
              {...register("amount")}
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
                Recording…
              </>
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

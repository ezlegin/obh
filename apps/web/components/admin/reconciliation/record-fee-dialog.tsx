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
import { recordProviderFeeAction } from "@/app/admin/reconciliation/actions"
import type { ProviderAccountBalanceView } from "@/server/reconciliation/queries"
import {
  recordProviderFeeSchema,
  type RecordProviderFeeInput,
} from "@/lib/validation/reconciliation"
import { todayInputValue } from "@/lib/admin/format"

function RecordFeeDialog({
  account,
  open,
  onOpenChange,
  onCreated,
}: {
  account: ProviderAccountBalanceView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordProviderFeeInput>({
    resolver: zodResolver(recordProviderFeeSchema),
    defaultValues: {
      providerAccountId: account?.id ?? "",
      paymentId: "",
      kind: "GATEWAY_FEE",
      status: "SETTLED",
      amount: "",
      chargedAt: todayInputValue(),
      reference: "",
      note: "",
    },
  })

  useEffect(() => {
    if (open && account) {
      setServerError(null)
      reset({
        providerAccountId: account.id,
        paymentId: "",
        kind: "GATEWAY_FEE",
        status: "SETTLED",
        amount: "",
        chargedAt: todayInputValue(),
        reference: "",
        note: "",
      })
    }
  }, [open, account, reset])

  if (!account) {
    return null
  }

  const onSubmit = (values: RecordProviderFeeInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = await recordProviderFeeAction(values)

      if (!result.ok) {
        setServerError(
          result.error ?? "The provider fee could not be recorded."
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
      title={`Record provider fee · ${account.name}`}
      description="Settled fees reduce the calculated provider balance. Pending fees are tracked but not deducted until settled."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <input type="hidden" {...register("providerAccountId")} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fee-kind">Fee kind</Label>
            <NativeSelect id="fee-kind" {...register("kind")}>
              <option value="GATEWAY_FEE">Gateway fee</option>
              <option value="COMMISSION">Commission</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee-status">Status</Label>
            <NativeSelect id="fee-status" {...register("status")}>
              <option value="SETTLED">Settled</option>
              <option value="PENDING">Pending</option>
            </NativeSelect>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fee-amount">Amount ({account.currency})</Label>
            <AmountInput
              id="fee-amount"
              control={control}
              name="amount"
              ariaInvalid={Boolean(errors.amount)}
            />
            {errors.amount ? (
              <p className="text-xs text-danger">{errors.amount.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee-date">Charged on</Label>
            <Input
              id="fee-date"
              type="date"
              aria-invalid={Boolean(errors.chargedAt)}
              {...register("chargedAt")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fee-payment">Linked payment</Label>
          <NativeSelect id="fee-payment" {...register("paymentId")}>
            <option value="">No linked payment</option>
            {account.paymentOptions.map((payment) => (
              <option key={payment.id} value={payment.id}>
                {payment.reference} · {payment.amount} {account.currency}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fee-reference">Provider reference</Label>
          <Input id="fee-reference" {...register("reference")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fee-note">Note</Label>
          <Textarea id="fee-note" {...register("note")} />
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
                Recording…
              </>
            ) : (
              "Record fee"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { RecordFeeDialog }

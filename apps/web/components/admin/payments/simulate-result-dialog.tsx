"use client"

import { FlaskConical, Loader2 } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { simulateDevelopmentPaymentResultAction } from "@/app/admin/payments/actions"
import type { AdminPayment } from "@/server/payments/queries"
import { formatIrrDecimal } from "@/lib/admin/format"

type OutcomeValues = {
  outcome: "success" | "failure"
}

type SimulateResultDialogProps = {
  payment: AdminPayment | null
  onOpenChange: (open: boolean) => void
  onCompleted: () => void
}

function SimulateResultDialog({
  payment,
  onOpenChange,
  onCompleted,
}: SimulateResultDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OutcomeValues>({
    defaultValues: { outcome: "success" },
  })

  useEffect(() => {
    if (payment) {
      setServerError(null)
      reset({ outcome: "success" })
    }
  }, [payment, reset])

  if (!payment) {
    return null
  }

  const onSubmit = (values: OutcomeValues) => {
    setServerError(null)

    startTransition(async () => {
      const result = await simulateDevelopmentPaymentResultAction({
        paymentId: payment.id,
        outcome: values.outcome,
      })

      if (!result.ok) {
        setServerError(result.error ?? "The result could not be recorded.")
        return
      }

      onOpenChange(false)
      onCompleted()
    })
  }

  return (
    <AdminDialog
      open
      onOpenChange={onOpenChange}
      title="Simulate provider result"
      description="This records a simulated development result. It is not proof of a real payment."
    >
      <div className="rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
        <div className="flex items-start gap-3">
          <FlaskConical
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Only a pending TEST payment using the development adapter can be
            finalized here. The resulting events are marked as simulated.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-white/[0.025] p-4">
        <p className="font-mono text-[10px] text-muted-foreground">
          {payment.reference}
        </p>
        <p className="mt-2 text-lg font-medium tabular-nums">
          {formatIrrDecimal(payment.amount)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {payment.description}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="payment-outcome">Simulated result</Label>
          <NativeSelect id="payment-outcome" {...register("outcome")}>
            <option value="success">Successful verification</option>
            <option value="failure">Failed verification</option>
          </NativeSelect>
          {errors.outcome ? (
            <p className="text-xs text-danger">{errors.outcome.message}</p>
          ) : null}
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
              "Record simulated result"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { SimulateResultDialog }

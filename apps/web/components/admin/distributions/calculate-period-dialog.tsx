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
import { calculateProfitPeriodAction } from "@/app/admin/distributions/actions"
import {
  calculateProfitPeriodSchema,
  type CalculateProfitPeriodInput,
} from "@/lib/validation/equity"

function CalculatePeriodDialog({
  currentMonth,
  defaultRetentionPercentage,
  open,
  onOpenChange,
  onCalculated,
}: {
  currentMonth: string
  defaultRetentionPercentage: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCalculated: (profitPeriodId: string) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CalculateProfitPeriodInput>({
    resolver: zodResolver(calculateProfitPeriodSchema),
    defaultValues: {
      month: currentMonth,
      retentionPercentage: defaultRetentionPercentage,
      reserveAmount: "0",
      taxAmount: "0",
      adjustmentNote: "",
    },
  })

  const watchedRetention = watch("retentionPercentage")
  const parsedRetention = Number.parseFloat(watchedRetention || "0")
  const safeRetention =
    Number.isFinite(parsedRetention) && parsedRetention >= 0 && parsedRetention <= 100
      ? parsedRetention
      : 0
  const shareholderSharePercentage = Number(
    (100 - safeRetention).toFixed(4)
  )

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset({
        month: currentMonth,
        retentionPercentage: defaultRetentionPercentage,
        reserveAmount: "0",
        taxAmount: "0",
        adjustmentNote: "",
      })
    }
  }, [open, currentMonth, defaultRetentionPercentage, reset])

  const onSubmit = (values: CalculateProfitPeriodInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = await calculateProfitPeriodAction(values)

      if (!result.ok || !result.profitPeriodId) {
        setServerError(
          result.error ?? "The profit period could not be calculated."
        )
        return
      }

      onOpenChange(false)
      onCalculated(result.profitPeriodId)
    })
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Calculate a monthly profit period"
      description="Cash basis: completed LIVE payments plus manual income, minus paid expenses, settled LIVE provider fees, and tax — then split between company retained earnings and shareholder distributions."
      className="max-w-2xl"
    >
      <div className="rounded-xl border border-info/20 bg-info/[0.035] p-4">
        <p className="text-[11px] leading-5 text-muted-foreground">
          {safeRetention}% of net profit remains in the company as retained
          earnings for future growth and expenses. The remaining{" "}
          {shareholderSharePercentage}% is distributed among shareholders
          according to their unchanged 100.0000% ownership percentages.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profit-month">Profit month</Label>
            <Input
              id="profit-month"
              type="month"
              aria-invalid={Boolean(errors.month)}
              {...register("month")}
            />
            {errors.month ? (
              <p className="text-xs text-danger">{errors.month.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profit-retention">
              Company retention (%)
            </Label>
            <Input
              id="profit-retention"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="40"
              aria-invalid={Boolean(errors.retentionPercentage)}
              {...register("retentionPercentage")}
            />
            <p className="text-[10px] text-muted-foreground">
              Retained in company: {safeRetention}% · Distributed to
              shareholders: {shareholderSharePercentage}%
            </p>
            {errors.retentionPercentage ? (
              <p className="text-xs text-danger">
                {errors.retentionPercentage.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profit-tax">Tax (R)</Label>
            <AmountInput
              id="profit-tax"
              control={control}
              name="taxAmount"
              ariaInvalid={Boolean(errors.taxAmount)}
            />
            {errors.taxAmount ? (
              <p className="text-xs text-danger">{errors.taxAmount.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profit-reserve">
              Additional fixed reserve (R, optional)
            </Label>
            <AmountInput
              id="profit-reserve"
              control={control}
              name="reserveAmount"
              ariaInvalid={Boolean(errors.reserveAmount)}
            />
            {errors.reserveAmount ? (
              <p className="text-xs text-danger">
                {errors.reserveAmount.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profit-adjustment-note">
            Reserve / tax explanation
          </Label>
          <Textarea
            id="profit-adjustment-note"
            placeholder="Approved reserve or tax basis for this month"
            {...register("adjustmentNote")}
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
                Calculating…
              </>
            ) : (
              "Calculate period"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { CalculatePeriodDialog }

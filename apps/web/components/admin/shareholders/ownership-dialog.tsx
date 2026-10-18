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
import { createOwnershipRecordAction } from "@/app/admin/shareholders/actions"
import {
  createOwnershipRecordSchema,
  type CreateOwnershipRecordInput,
} from "@/lib/validation/equity"
import type { AdminShareholder } from "@/server/equity/queries"
import { todayInputValue } from "@/lib/admin/format"

function OwnershipDialog({
  shareholder,
  open,
  onOpenChange,
  onCreated,
}: {
  shareholder: AdminShareholder | null
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
  } = useForm<CreateOwnershipRecordInput>({
    resolver: zodResolver(createOwnershipRecordSchema),
    defaultValues: {
      shareholderId: shareholder?.id ?? "",
      percentage: "",
      effectiveFrom: todayInputValue(),
      effectiveTo: "",
      note: "",
    },
  })

  useEffect(() => {
    if (open && shareholder) {
      setServerError(null)
      reset({
        shareholderId: shareholder.id,
        percentage: "",
        effectiveFrom: todayInputValue(),
        effectiveTo: "",
        note: "",
      })
    }
  }, [open, shareholder, reset])

  if (!shareholder) {
    return null
  }

  const onSubmit = (values: CreateOwnershipRecordInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createOwnershipRecordAction(values)

      if (!result.ok) {
        setServerError(
          result.error ?? "The ownership record could not be added."
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
      title={`Add ownership · ${shareholder.name}`}
      description="Ownership records are historical. Overlapping periods for the same shareholder are rejected. Profit periods require the total ownership on the period end date to equal exactly 100.0000%."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <input type="hidden" {...register("shareholderId")} />

        <div className="space-y-2">
          <Label htmlFor="ownership-percentage">Ownership percentage</Label>
          <Input
            id="ownership-percentage"
            inputMode="decimal"
            placeholder="50.0000"
            aria-invalid={Boolean(errors.percentage)}
            {...register("percentage")}
          />
          {errors.percentage ? (
            <p className="text-xs text-danger">{errors.percentage.message}</p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownership-from">Effective from</Label>
            <Input
              id="ownership-from"
              type="date"
              aria-invalid={Boolean(errors.effectiveFrom)}
              {...register("effectiveFrom")}
            />
            {errors.effectiveFrom ? (
              <p className="text-xs text-danger">
                {errors.effectiveFrom.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownership-to">Effective to</Label>
            <Input
              id="ownership-to"
              type="date"
              aria-invalid={Boolean(errors.effectiveTo)}
              {...register("effectiveTo")}
            />
            <p className="text-[10px] text-muted-foreground">
              Leave blank for an open-ended record.
            </p>
            {errors.effectiveTo ? (
              <p className="text-xs text-danger">
                {errors.effectiveTo.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownership-note">Note</Label>
          <Textarea id="ownership-note" {...register("note")} />
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
                Adding…
              </>
            ) : (
              "Add ownership record"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { OwnershipDialog }

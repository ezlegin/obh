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
import {
  createShareholderAction,
  updateShareholderAction,
} from "@/app/admin/shareholders/actions"
import {
  createShareholderSchema,
  type CreateShareholderInput,
} from "@/lib/validation/equity"
import type { AdminShareholder } from "@/server/equity/queries"

function ShareholderDialog({
  shareholder,
  open,
  onOpenChange,
  onSaved,
}: {
  shareholder: AdminShareholder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateShareholderInput>({
    resolver: zodResolver(createShareholderSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset({
        name: shareholder?.name ?? "",
        email: shareholder?.email ?? "",
        phone: shareholder?.phone ?? "",
        notes: shareholder?.notes ?? "",
      })
    }
  }, [open, shareholder, reset])

  const onSubmit = (values: CreateShareholderInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = shareholder
        ? await updateShareholderAction({
            ...values,
            shareholderId: shareholder.id,
          })
        : await createShareholderAction(values)

      if (!result.ok) {
        setServerError(result.error ?? "The shareholder could not be saved.")
        return
      }

      onOpenChange(false)
      onSaved()
    })
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={shareholder ? "Edit shareholder" : "Add a shareholder"}
      description="Contact details are internal. Ownership percentages are recorded separately as historical effective dates."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="shareholder-name">Name</Label>
          <Input
            id="shareholder-name"
            placeholder="Shareholder name"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs text-danger">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="shareholder-email">Email</Label>
            <Input
              id="shareholder-email"
              type="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-danger">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="shareholder-phone">Phone</Label>
            <Input id="shareholder-phone" {...register("phone")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shareholder-notes">Notes</Label>
          <Textarea id="shareholder-notes" {...register("notes")} />
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
                Saving…
              </>
            ) : shareholder ? (
              "Save shareholder"
            ) : (
              "Add shareholder"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { ShareholderDialog }

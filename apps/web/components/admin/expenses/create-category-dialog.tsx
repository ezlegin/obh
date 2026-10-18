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
import { createExpenseCategoryAction } from "@/app/admin/expenses/actions"
import {
  createExpenseCategorySchema,
  type CreateExpenseCategoryInput,
} from "@/lib/validation/accounting"

function CreateCategoryDialog({
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
  } = useForm<CreateExpenseCategoryInput>({
    resolver: zodResolver(createExpenseCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      requiresDocument: false,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset({
        name: "",
        description: "",
        requiresDocument: false,
        sortOrder: 0,
      })
    }
  }, [open, reset])

  const onSubmit = (values: CreateExpenseCategoryInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createExpenseCategoryAction({
        ...values,
        sortOrder: Number(values.sortOrder),
      })

      if (!result.ok) {
        setServerError(result.error ?? "The category could not be created.")
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
      title="Create an expense category"
      description="Categories control reporting and whether at least one supporting document is required before an expense can be marked paid."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            placeholder="Software & subscriptions"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name ? (
            <p className="text-xs text-danger">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-description">Description</Label>
          <Textarea id="category-description" {...register("description")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-sort">Sort order</Label>
          <Input
            id="category-sort"
            type="number"
            min={0}
            max={999}
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border p-4">
          <input
            type="checkbox"
            aria-label="Require a supporting document"
            className="mt-0.5 size-4 accent-white"
            {...register("requiresDocument")}
          />
          <span>
            <span className="block text-xs font-medium">
              Require a supporting document
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
              An expense in this category cannot be marked paid until at least
              one PDF or image is attached.
            </span>
          </span>
        </label>

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
              "Create category"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { CreateCategoryDialog }

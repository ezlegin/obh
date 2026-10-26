"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, Loader2 } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { AmountInput } from "@/components/admin/amount-input"
import { createRecurringExpenseAction } from "@/app/admin/expenses/actions"
import {
  createRecurringExpenseSchema,
  type CreateRecurringExpenseInput,
} from "@/lib/validation/accounting"
import { todayInputValue } from "@/lib/admin/format"

type CategoryOption = { id: string; name: string }
type AccountOption = { id: string; name: string }

function CreateRecurringDialog({
  open,
  onOpenChange,
  categories,
  accounts,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CategoryOption[]
  accounts: AccountOption[]
  onCreated: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const firstCategory = categories[0]
  const firstAccount = accounts[0]

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRecurringExpenseInput>({
    resolver: zodResolver(createRecurringExpenseSchema),
    defaultValues: {
      categoryId: firstCategory?.id ?? "",
      accountId: firstAccount?.id ?? "",
      amount: "",
      description: "",
      frequency: "MONTHLY",
      intervalCount: 1,
      startOn: todayInputValue(),
      endOn: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset({
        categoryId: firstCategory?.id ?? "",
        accountId: firstAccount?.id ?? "",
        amount: "",
        description: "",
        frequency: "MONTHLY",
        intervalCount: 1,
        startOn: todayInputValue(),
        endOn: "",
        notes: "",
      })
    }
  }, [open, firstCategory?.id, firstAccount?.id, reset])

  const onSubmit = (values: CreateRecurringExpenseInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createRecurringExpenseAction({
        ...values,
        intervalCount: Number(values.intervalCount),
      })

      if (!result.ok) {
        setServerError(
          result.error ?? "The recurring expense could not be created."
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
      title="Create a recurring expense rule"
      description="Recurring rules are active immediately and generate paid expenses when due."
      className="max-w-2xl"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recurring-category">Category</Label>
            <div className="relative">
              <NativeSelect id="recurring-category" {...register("categoryId")}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-amount">Amount (R)</Label>
            <AmountInput
              id="recurring-amount"
              control={control}
              name="amount"
              placeholder="8,500,000"
              ariaInvalid={Boolean(errors.amount)}
            />
            {errors.amount ? (
              <p className="text-xs text-danger">{errors.amount.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recurring-description">Description</Label>
          <Input
            id="recurring-description"
            placeholder="Monthly hosting contract"
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          {errors.description ? (
            <p className="text-xs text-danger">{errors.description.message}</p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="recurring-frequency">Frequency</Label>
            <div className="relative">
              <NativeSelect id="recurring-frequency" {...register("frequency")}>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </NativeSelect>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-interval">Repeat every</Label>
            <Input
              id="recurring-interval"
              type="number"
              min={1}
              max={24}
              {...register("intervalCount", { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-account">Payment source</Label>
            <div className="relative">
              <NativeSelect id="recurring-account" {...register("accountId")}>
                <option value="">No source yet</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recurring-start">First due date</Label>
            <Input
              id="recurring-start"
              type="date"
              aria-invalid={Boolean(errors.startOn)}
              {...register("startOn")}
            />
            {errors.startOn ? (
              <p className="text-xs text-danger">{errors.startOn.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-end">End date</Label>
            <Input
              id="recurring-end"
              type="date"
              aria-invalid={Boolean(errors.endOn)}
              {...register("endOn")}
            />
            {errors.endOn ? (
              <p className="text-xs text-danger">{errors.endOn.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recurring-notes">Notes</Label>
          <Textarea id="recurring-notes" {...register("notes")} />
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
              "Create recurring rule"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { CreateRecurringDialog }

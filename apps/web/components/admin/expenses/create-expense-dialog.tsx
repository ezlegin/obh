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
import { createExpenseAction } from "@/app/admin/expenses/actions"
import {
  createExpenseSchema,
  type CreateExpenseInput,
} from "@/lib/validation/accounting"
import { todayInputValue } from "@/lib/admin/format"

type CategoryOption = { id: string; name: string; requiresDocument: boolean }
type AccountOption = { id: string; name: string }

function CreateExpenseDialog({
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
  onCreated: (expenseId: string) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const firstCategory = categories[0]

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      categoryId: firstCategory?.id ?? "",
      accountId: "",
      amount: "",
      spentOn: todayInputValue(),
      description: "",
      notes: "",
      externalReference: "",
    },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset({
        categoryId: firstCategory?.id ?? "",
        accountId: "",
        amount: "",
        spentOn: todayInputValue(),
        description: "",
        notes: "",
        externalReference: "",
      })
    }
  }, [open, firstCategory?.id, reset])

  const onSubmit = (values: CreateExpenseInput) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createExpenseAction(values)

      if (!result.ok || !result.expenseId) {
        setServerError(result.error ?? "The expense could not be recorded.")
        return
      }

      onOpenChange(false)
      onCreated(result.expenseId)
    })
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record an expense"
      description="Expenses begin pending. Attach supporting documents, then mark the expense paid against a business payment source."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-category">Category</Label>
            <div className="relative">
              <NativeSelect id="expense-category" {...register("categoryId")}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.requiresDocument ? " · document required" : ""}
                  </option>
                ))}
              </NativeSelect>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            {errors.categoryId ? (
              <p className="text-xs text-danger">{errors.categoryId.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount (IRR)</Label>
            <Input
              id="expense-amount"
              inputMode="decimal"
              placeholder="12000000"
              aria-invalid={Boolean(errors.amount)}
              {...register("amount")}
            />
            {errors.amount ? (
              <p className="text-xs text-danger">{errors.amount.message}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-date">Expense date</Label>
            <Input
              id="expense-date"
              type="date"
              aria-invalid={Boolean(errors.spentOn)}
              {...register("spentOn")}
            />
            {errors.spentOn ? (
              <p className="text-xs text-danger">{errors.spentOn.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-account">Payment source</Label>
            <div className="relative">
              <NativeSelect id="expense-account" {...register("accountId")}>
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

        <div className="space-y-2">
          <Label htmlFor="expense-description">Description</Label>
          <Input
            id="expense-description"
            placeholder="What was purchased"
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          {errors.description ? (
            <p className="text-xs text-danger">{errors.description.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-reference">External reference</Label>
          <Input
            id="expense-reference"
            placeholder="Invoice or receipt number"
            {...register("externalReference")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-notes">Notes</Label>
          <Textarea id="expense-notes" {...register("notes")} />
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
              "Record expense"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { CreateExpenseDialog }

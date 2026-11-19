"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { AmountInput } from "@/components/admin/amount-input"
import { VatAmountField } from "@/components/admin/vat-amount-field"
import { createIncomeAction } from "@/app/admin/income/actions"
import { updateIncomeAction } from "@/app/admin/income/edit-actions"
import type {
  AdminIncome,
  AdminServiceOption,
} from "@/server/accounting/queries"
import {
  createIncomeSchema,
  type CreateIncomeInput,
} from "@/lib/validation/accounting"
import { todayInputValue } from "@/lib/admin/format"

function getIncomeDefaults(
  income: AdminIncome | null | undefined,
  firstAccount: { id: string } | undefined
): CreateIncomeInput {
  if (income) {
    return {
      accountId: income.accountId ?? "",
      serviceId: income.serviceId ?? "",
      amount: income.amount.replace(/\.00$/, ""),
      vatAmount:
        income.vatAmount === "0.00"
          ? ""
          : income.vatAmount.replace(/\.00$/, ""),
      receivedOn: income.receivedOn,
      description: income.description,
      source: income.source ?? "",
      externalReference: income.externalReference ?? "",
      notes: income.notes ?? "",
    }
  }

  return {
    accountId: firstAccount?.id ?? "",
    serviceId: "",
    amount: "",
    vatAmount: "",
    receivedOn: todayInputValue(),
    description: "",
    source: "",
    externalReference: "",
    notes: "",
  }
}

function CreateIncomeDialog({
  open,
  onOpenChange,
  accounts,
  services,
  income,
  vatEffectiveFrom,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Array<{ id: string; name: string }>
  services: AdminServiceOption[]
  income?: AdminIncome | null
  vatEffectiveFrom: string | null
  onCreated: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const firstAccount = accounts[0]
  const isEditing = Boolean(income)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateIncomeInput>({
    resolver: zodResolver(createIncomeSchema),
    defaultValues: getIncomeDefaults(null, firstAccount),
  })
  const [watchedAmount, watchedDate, watchedVat] = useWatch({
    control,
    name: ["amount", "receivedOn", "vatAmount"],
  })
  const setVatAmount = useCallback(
    (value: string) => setValue("vatAmount", value, { shouldDirty: true }),
    [setValue]
  )

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset(getIncomeDefaults(income, firstAccount))
    }
  }, [open, income, firstAccount?.id, reset])

  const onSubmit = (values: CreateIncomeInput) => {
    setServerError(null)

    startTransition(async () => {
      if (income) {
        const result = await updateIncomeAction({
          ...values,
          incomeId: income.id,
        })

        if (!result.ok) {
          setServerError(
            result.error ?? "The income record could not be updated."
          )
          return
        }

        onOpenChange(false)
        onCreated()
        return
      }

      const result = await createIncomeAction(values)

      if (!result.ok) {
        setServerError(
          result.error ?? "The income record could not be created."
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
      title={isEditing ? "Edit income" : "Record additional income"}
      description={
        isEditing
          ? "Update the income record. Changes are recorded in the audit log."
          : "Recorded income directly increases the business balance alongside completed gateway payments."
      }
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="income-amount">Total received (R)</Label>
            <AmountInput
              id="income-amount"
              control={control}
              name="amount"
              placeholder="40,000,000"
              ariaInvalid={Boolean(errors.amount)}
            />
            {errors.amount ? (
              <p className="text-xs text-danger">{errors.amount.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="income-date">Received on</Label>
            <Input
              id="income-date"
              type="date"
              aria-invalid={Boolean(errors.receivedOn)}
              {...register("receivedOn")}
            />
            {errors.receivedOn ? (
              <p className="text-xs text-danger">{errors.receivedOn.message}</p>
            ) : null}
          </div>
        </div>

        <VatAmountField
          key={open ? (income?.id ?? "new") : "closed"}
          id="income-vat"
          amount={watchedAmount}
          dateOnly={watchedDate}
          vatAmount={watchedVat}
          vatEffectiveFrom={vatEffectiveFrom}
          initiallyIncluded={income ? income.vatAmount !== "0.00" : true}
          onChange={setVatAmount}
          error={errors.vatAmount?.message}
          hint="The VAT inside this total is owed to the tax authority, so it is not counted as revenue."
        />

        <div className="space-y-2">
          <Label htmlFor="income-service">Service (optional)</Label>
          <div className="relative">
            <NativeSelect id="income-service" {...register("serviceId")}>
              <option value="">No service · corporation-wide</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.domain}
                </option>
              ))}
            </NativeSelect>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground/60">
            Attribute this income to a service for service-level profit reports.
            Leave empty for corporation-wide income.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="income-description">Description</Label>
          <Input
            id="income-description"
            placeholder="Consulting engagement"
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          {errors.description ? (
            <p className="text-xs text-danger">{errors.description.message}</p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="income-source">Income source</Label>
            <Input
              id="income-source"
              placeholder="Consulting, grant, other"
              {...register("source")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="income-account">Payment source</Label>
            <div className="relative">
              <NativeSelect id="income-account" {...register("accountId")}>
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
          <Label htmlFor="income-reference">External reference</Label>
          <Input
            id="income-reference"
            placeholder="Invoice or transfer reference"
            {...register("externalReference")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="income-notes">Notes</Label>
          <Textarea id="income-notes" {...register("notes")} />
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
                {isEditing ? "Saving…" : "Recording…"}
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Record income"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { CreateIncomeDialog }

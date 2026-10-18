"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, FlaskConical, Loader2 } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { createDevelopmentPaymentAction } from "@/app/admin/payments/actions"
import {
  createDevelopmentPaymentSchema,
  type CreateDevelopmentPaymentInputForm,
} from "@/lib/validation/payment-platform"

type PaymentServiceOption = {
  id: string
  name: string
  domain: string
}

type PaymentAccountOption = {
  id: string
  name: string
  providerName: string
}

type CreatePaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: PaymentServiceOption[]
  accounts: PaymentAccountOption[]
  onCreated: () => void
}

function CreatePaymentDialog({
  open,
  onOpenChange,
  services,
  accounts,
  onCreated,
}: CreatePaymentDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDevelopmentPaymentInputForm>({
    resolver: zodResolver(createDevelopmentPaymentSchema),
    defaultValues: {
      serviceId: services[0]?.id ?? "",
      providerAccountId: accounts[0]?.id ?? "",
      amount: "",
      description: "",
      externalOrderId: "",
    },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset({
        serviceId: services[0]?.id ?? "",
        providerAccountId: accounts[0]?.id ?? "",
        amount: "",
        description: "",
        externalOrderId: "",
      })
    }
  }, [open, services, accounts, reset])

  const onSubmit = (values: CreateDevelopmentPaymentInputForm) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createDevelopmentPaymentAction(values)

      if (!result.ok) {
        setServerError(result.error ?? "The test payment could not be created.")
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
      title="Create a development payment"
      description="This creates a TEST payment record and a simulated provider session. No real gateway is contacted and no real money moves."
      className="max-w-2xl"
    >
      <div className="rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
        <div className="flex items-start gap-3">
          <FlaskConical
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Development adapter only. The payment is stored with environment
            TEST and is never represented as a live transaction.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-service">Connected service</Label>
            <div className="relative">
              <NativeSelect id="payment-service" {...register("serviceId")}>
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
            {errors.serviceId ? (
              <p className="text-xs text-danger">{errors.serviceId.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-account">Provider account</Label>
            <div className="relative">
              <NativeSelect
                id="payment-account"
                {...register("providerAccountId")}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.providerName}
                  </option>
                ))}
              </NativeSelect>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            {errors.providerAccountId ? (
              <p className="text-xs text-danger">
                {errors.providerAccountId.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount (IRR)</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              placeholder="24500000"
              aria-invalid={Boolean(errors.amount)}
              {...register("amount")}
            />
            {errors.amount ? (
              <p className="text-xs text-danger">{errors.amount.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-order">External order ID</Label>
            <Input
              id="payment-order"
              placeholder="Order reference"
              {...register("externalOrderId")}
            />
            <p className="text-[10px] leading-4 text-muted-foreground/60">
              Optional here. The API will require an external order reference.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-description">Description</Label>
          <Textarea
            id="payment-description"
            placeholder="What is being purchased"
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          {errors.description ? (
            <p className="text-xs text-danger">{errors.description.message}</p>
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
                Creating test payment…
              </>
            ) : (
              "Create test payment"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { CreatePaymentDialog }

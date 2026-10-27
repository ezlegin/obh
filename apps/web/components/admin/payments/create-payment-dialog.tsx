"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { AmountInput } from "@/components/admin/amount-input"
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

type CreatedSessionResult = {
  reference: string
  checkoutUrl: string | null
  environment: "TEST" | "LIVE"
}

type CreatePaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: PaymentServiceOption[]
  onCreated: () => void
}

function CreatePaymentDialog({
  open,
  onOpenChange,
  services,
  onCreated,
}: CreatePaymentDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [createdSession, setCreatedSession] =
    useState<CreatedSessionResult | null>(null)
  const [copiedCheckout, setCopiedCheckout] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDevelopmentPaymentInputForm>({
    resolver: zodResolver(createDevelopmentPaymentSchema),
    defaultValues: {
      serviceId: services[0]?.id ?? "",
      environment: "TEST",
      amount: "",
      description: "",
      externalOrderId: "",
    },
  })

  const selectedEnv = watch("environment") ?? "TEST"

  useEffect(() => {
    if (open) {
      setServerError(null)
      setCreatedSession(null)
      setCopiedCheckout(false)
      reset({
        serviceId: services[0]?.id ?? "",
        environment: "TEST",
        amount: "",
        description: "",
        externalOrderId: "",
      })
    }
  }, [open, services, reset])

  const copyCheckoutUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCheckout(true)
      window.setTimeout(() => setCopiedCheckout(false), 1600)
    } catch {
      // Clipboard unavailable
    }
  }

  const onSubmit = (values: CreateDevelopmentPaymentInputForm) => {
    setServerError(null)

    startTransition(async () => {
      const result = await createDevelopmentPaymentAction(values)

      if (!result.ok) {
        setServerError(result.error ?? "The payment could not be created.")
        return
      }

      onCreated()
      setCreatedSession({
        reference: result.reference ?? "",
        checkoutUrl: result.checkoutUrl ?? null,
        environment: result.environment ?? (values.environment ?? "TEST"),
      })
    })
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        createdSession
          ? `Payment ${createdSession.reference} ready`
          : selectedEnv === "LIVE"
            ? "Create a LIVE Sadad payment"
            : "Create a Sadad test payment"
      }
      description={
        createdSession
          ? createdSession.environment === "LIVE"
            ? "Sadad issued a real Shaparak checkout token. Open the checkout link below to pay with a real Iranian bank card and test the live callback."
            : "Simulated Sadad session token created. Open the simulator checkout or simulate the result from the payments table."
          : selectedEnv === "LIVE"
            ? "Creates a real LIVE payment on Bank Melli Sadad (Shaparak) and generates a live checkout link."
            : "Creates a TEST payment record on the auto-provisioned Sadad simulator account."
      }
      className="max-w-2xl"
    >
      {createdSession ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-medium">
                {createdSession.reference}
              </span>
              <Badge
                variant={
                  createdSession.environment === "LIVE" ? "success" : "warning"
                }
              >
                {createdSession.environment}
              </Badge>
            </div>
            {createdSession.checkoutUrl ? (
              <div className="mt-3 space-y-2">
                <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                  Sadad Checkout URL
                </p>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-black/30 px-3 py-2">
                  <span className="truncate font-mono text-xs text-foreground">
                    {createdSession.checkoutUrl}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      copyCheckoutUrl(createdSession.checkoutUrl ?? "")
                    }
                  >
                    {copiedCheckout ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Copy aria-hidden="true" className="size-3.5" />
                    )}
                    {copiedCheckout ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
            {createdSession.checkoutUrl ? (
              <a
                href={createdSession.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "default" }))}
              >
                Open Sadad Checkout
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.02] p-2">
            <span className="pl-2 text-xs font-medium text-muted-foreground">
              Gateway mode
            </span>
            <div
              role="group"
              aria-label="Payment gateway environment"
              className="inline-flex items-center rounded-lg border border-border bg-black/30 p-0.5"
            >
              {(
                [
                  { id: "TEST" as const, label: "TEST (Simulator)" },
                  { id: "LIVE" as const, label: "LIVE (Real Sadad)" },
                ] as const
              ).map((option) => {
                const active = selectedEnv === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setValue("environment", option.id, {
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? option.id === "LIVE"
                          ? "bg-success text-white"
                          : "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {selectedEnv === "LIVE" ? (
            <div className="mt-4 rounded-xl border border-success/25 bg-success/[0.05] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-success"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  <strong className="font-medium text-foreground">
                    Real Sadad Gateway (LIVE):
                  </strong>{" "}
                  Calls <span className="font-mono">sadad.shaparak.ir</span>{" "}
                  using your server&apos;s LIVE credentials and returns a real
                  Shaparak checkout link. Completed payments will verify via the
                  live callback and increase the business balance.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
              <div className="flex items-start gap-3">
                <FlaskConical
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-warning"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Sadad simulator (TEST environment). Amounts must be positive
                  whole Rial integers without decimals.
                </p>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="mt-5 space-y-5"
          >
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
                <p className="text-xs text-danger">
                  {errors.serviceId.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount (R)</Label>
                <AmountInput
                  id="payment-amount"
                  control={control}
                  name="amount"
                  placeholder="150,000"
                  allowDecimal={false}
                  ariaInvalid={Boolean(errors.amount)}
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
                  Optional here. Auto-generated if left blank.
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
                <p className="text-xs text-danger">
                  {errors.description.message}
                </p>
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
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    {selectedEnv === "LIVE"
                      ? "Requesting Sadad token…"
                      : "Creating test payment…"}
                  </>
                ) : selectedEnv === "LIVE" ? (
                  "Create LIVE Sadad payment"
                ) : (
                  "Create test payment"
                )}
              </Button>
            </div>
          </form>
        </>
      )}
    </AdminDialog>
  )
}

export { CreatePaymentDialog }

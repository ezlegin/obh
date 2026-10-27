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
import type { AdminPaymentGatewayOption } from "@/server/payments/providers/registry"

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
  gateways: AdminPaymentGatewayOption[]
  onCreated: () => void
}

function CreatePaymentDialog({
  open,
  onOpenChange,
  services,
  gateways,
  onCreated,
}: CreatePaymentDialogProps) {
  const defaultGateway =
    gateways.find((gateway) => gateway.isDefault)?.code ??
    gateways[0]?.code ??
    "sadad"
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
      gateway: defaultGateway,
      customerMobile: "",
      amount: "",
      description: "",
      externalOrderId: "",
    },
  })

  const selectedEnv = watch("environment") ?? "TEST"
  const selectedGatewayCode = watch("gateway") ?? defaultGateway
  const selectedGateway =
    gateways.find((gateway) => gateway.code === selectedGatewayCode) ??
    gateways[0]
  const gatewayName = selectedGateway?.name ?? "Sadad"
  const liveAvailable = selectedGateway?.liveConfigured ?? false

  const selectGateway = (gateway: AdminPaymentGatewayOption) => {
    setValue("gateway", gateway.code, { shouldValidate: true })
    if (!gateway.liveConfigured) {
      setValue("environment", "TEST", { shouldValidate: true })
    }
    if (!gateway.requiresCustomerMobile) {
      setValue("customerMobile", "")
    }
  }

  useEffect(() => {
    if (open) {
      setServerError(null)
      setCreatedSession(null)
      setCopiedCheckout(false)
      reset({
        serviceId: services[0]?.id ?? "",
        environment: "TEST",
        gateway: defaultGateway,
        customerMobile: "",
        amount: "",
        description: "",
        externalOrderId: "",
      })
    }
  }, [open, services, reset, defaultGateway])

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
        environment: result.environment ?? values.environment ?? "TEST",
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
            ? `Create a LIVE ${gatewayName} payment`
            : `Create a ${gatewayName} test payment`
      }
      description={
        createdSession
          ? createdSession.environment === "LIVE"
            ? `${gatewayName} issued a real checkout link. Open it to pay for real and test the live callback.`
            : `Simulated ${gatewayName} checkout created. Open the simulator checkout or simulate the result from the payments table.`
          : selectedEnv === "LIVE"
            ? `Creates a real LIVE payment on ${gatewayName} and generates a live checkout link.`
            : `Creates a TEST payment on the auto-provisioned ${gatewayName} simulator account.`
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
                  {gatewayName} checkout URL
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
                Open {gatewayName} checkout
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-medium text-muted-foreground">
              Payment gateway
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {gateways.map((gateway) => {
                const active = gateway.code === selectedGatewayCode
                return (
                  <button
                    key={gateway.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectGateway(gateway)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-foreground/40 bg-white/[0.06]"
                        : "border-border hover:border-foreground/20"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">
                        {gateway.name}
                      </span>
                      <Badge
                        variant={
                          gateway.kind === "installment" ? "info" : "outline"
                        }
                      >
                        {gateway.kind === "installment"
                          ? "Installments"
                          : "Card"}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                      {gateway.displayName}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground/70">
                      {gateway.liveConfigured
                        ? "LIVE and TEST available"
                        : "TEST only (LIVE credentials not set)"}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

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
                  { id: "LIVE" as const, label: "LIVE (Real gateway)" },
                ] as const
              ).map((option) => {
                const active = selectedEnv === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.id === "LIVE" && !liveAvailable}
                    title={
                      option.id === "LIVE" && !liveAvailable
                        ? `LIVE ${gatewayName} credentials are not configured on the server.`
                        : undefined
                    }
                    onClick={() =>
                      setValue("environment", option.id, {
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
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
                    Real {gatewayName} (LIVE):
                  </strong>{" "}
                  Uses your server&apos;s LIVE credentials and returns a real
                  checkout link. Completed payments verify via the live callback
                  and increase the business balance
                  {selectedGateway?.kind === "installment"
                    ? " as each installment is deposited."
                    : "."}
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
                  {gatewayName} simulator (TEST environment). Amounts must be
                  positive whole Rial integers without decimals.
                  {selectedGateway?.kind === "installment"
                    ? " Simulating a BNPL or credit result creates a four-part installment schedule."
                    : ""}
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

            {selectedGateway?.requiresCustomerMobile ? (
              <div className="space-y-2">
                <Label htmlFor="payment-mobile">Customer mobile number</Label>
                <Input
                  id="payment-mobile"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="09121234567"
                  aria-invalid={Boolean(errors.customerMobile)}
                  {...register("customerMobile")}
                />
                {errors.customerMobile ? (
                  <p className="text-xs text-danger">
                    {errors.customerMobile.message}
                  </p>
                ) : (
                  <p className="text-[10px] leading-4 text-muted-foreground/60">
                    Required by {gatewayName}.
                  </p>
                )}
              </div>
            ) : null}

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
                      ? `Requesting ${gatewayName} checkout…`
                      : "Creating test payment…"}
                  </>
                ) : selectedEnv === "LIVE" ? (
                  `Create LIVE ${gatewayName} payment`
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

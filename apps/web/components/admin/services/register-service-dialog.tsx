"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { registerConnectedServiceAction } from "@/app/admin/services/actions"

const registerServiceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "Slug must be at least 2 characters.")
      .max(80)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and single hyphens."
      ),
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
        "Enter a domain such as example.com."
      ),
    description: z.string().trim().max(2000),
    returnUrls: z.string().max(5000),
    defaultReturnUrl: z.string().trim().max(2048),
    webhookUrl: z.string().trim().max(2048),
  })
  .superRefine((values, context) => {
    const urls = values.returnUrls
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)

    for (const value of urls) {
      try {
        const url = new URL(value)
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("Unsupported protocol")
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["returnUrls"],
          message: "Each return URL must be a complete http or https URL.",
        })
        break
      }
    }

    if (values.defaultReturnUrl) {
      try {
        const url = new URL(values.defaultReturnUrl)
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("Unsupported protocol")
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["defaultReturnUrl"],
          message: "Enter a complete http or https return URL.",
        })
      }
    }

    if (values.webhookUrl) {
      try {
        const url = new URL(values.webhookUrl)
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("Unsupported protocol")
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["webhookUrl"],
          message: "Enter a complete http or https webhook URL.",
        })
      }
    }
  })

type RegisterServiceValues = z.infer<typeof registerServiceSchema>

type RegisterServiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

function RegisterServiceDialog({
  open,
  onOpenChange,
  onCreated,
}: RegisterServiceDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterServiceValues>({
    resolver: zodResolver(registerServiceSchema),
    defaultValues: {
      name: "",
      slug: "",
      domain: "",
      description: "",
      returnUrls: "",
      defaultReturnUrl: "",
      webhookUrl: "",
    },
  })

  useEffect(() => {
    if (open) {
      setServerError(null)
      reset()
    }
  }, [open, reset])

  const onSubmit = (values: RegisterServiceValues) => {
    setServerError(null)

    const allowedReturnUrls = values.returnUrls
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)

    startTransition(async () => {
      const result = await registerConnectedServiceAction({
        name: values.name,
        slug: values.slug,
        domain: values.domain,
        description: values.description,
        allowedReturnUrls,
        defaultReturnUrl: values.defaultReturnUrl,
        webhookUrl: values.webhookUrl,
      })

      if (!result.ok) {
        setServerError(result.error ?? "The service could not be registered.")
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
      title="Register a connected service"
      description="Services authenticate with OBH through credentials issued separately below. Return URLs are exact allowlist entries for later payment API validation."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="service-name">Name</Label>
            <Input
              id="service-name"
              placeholder="iGraphical"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-xs text-danger">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-slug">Slug</Label>
            <Input
              id="service-slug"
              placeholder="igraphical"
              aria-invalid={Boolean(errors.slug)}
              {...register("slug")}
            />
            {errors.slug ? (
              <p className="text-xs text-danger">{errors.slug.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="service-domain">Domain</Label>
          <Input
            id="service-domain"
            placeholder="igraphical.ir"
            aria-invalid={Boolean(errors.domain)}
            {...register("domain")}
          />
          {errors.domain ? (
            <p className="text-xs text-danger">{errors.domain.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="service-description">Description</Label>
          <Textarea
            id="service-description"
            placeholder="What this service does"
            {...register("description")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="service-return-urls">Allowed return URLs</Label>
          <Textarea
            id="service-return-urls"
            placeholder={
              "https://service.example/payments/return\nhttps://service.example/checkout/complete"
            }
            aria-invalid={Boolean(errors.returnUrls)}
            {...register("returnUrls")}
          />
          <p className="text-[11px] leading-5 text-muted-foreground">
            One exact URL per line. These will be validated again by the
            versioned payment API.
          </p>
          {errors.returnUrls ? (
            <p className="text-xs text-danger">{errors.returnUrls.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="service-default-return-url">Default return URL</Label>
          <Input
            id="service-default-return-url"
            placeholder="https://service.example/payments/return"
            aria-invalid={Boolean(errors.defaultReturnUrl)}
            {...register("defaultReturnUrl")}
          />
          <p className="text-[11px] leading-5 text-muted-foreground">
            Optional. Must also appear in the allowed list. Used when the
            payment request omits returnUrl.
          </p>
          {errors.defaultReturnUrl ? (
            <p className="text-xs text-danger">
              {errors.defaultReturnUrl.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="service-webhook-url">Webhook URL</Label>
          <Input
            id="service-webhook-url"
            placeholder="https://service.example/webhooks/obh"
            aria-invalid={Boolean(errors.webhookUrl)}
            {...register("webhookUrl")}
          />
          <p className="text-[11px] leading-5 text-muted-foreground">
            Optional. Signed webhook delivery is defined in the payment API
            contract and will be implemented with the API.
          </p>
          {errors.webhookUrl ? (
            <p className="text-xs text-danger">{errors.webhookUrl.message}</p>
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
                Registering…
              </>
            ) : (
              "Register service"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { RegisterServiceDialog }

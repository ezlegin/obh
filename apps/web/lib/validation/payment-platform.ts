import { z } from "zod"

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters.")
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens."
  )

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter a domain.")
  .max(255)
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    "Enter a domain such as example.com."
  )

const httpUrlSchema = z
  .string()
  .trim()
  .url("Enter a complete URL.")
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }, "Use an http or https URL.")

export const createConnectedServiceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(160),
    slug: slugSchema,
    domain: domainSchema,
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    allowedReturnUrls: z.array(httpUrlSchema).max(20),
    defaultReturnUrl: httpUrlSchema.optional().or(z.literal("")),
    webhookUrl: httpUrlSchema.optional().or(z.literal("")),
  })
  .superRefine((values, context) => {
    if (
      values.defaultReturnUrl &&
      !values.allowedReturnUrls.includes(values.defaultReturnUrl)
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultReturnUrl"],
        message: "The default return URL must be in the allowed list.",
      })
    }
  })

export const issueServiceCredentialSchema = z.object({
  serviceId: z.string().uuid(),
  label: z
    .string()
    .trim()
    .min(2, "Label must be at least 2 characters.")
    .max(120),
  environment: z.enum(["TEST", "LIVE"]),
})

export const toggleConnectedServiceSchema = z.object({
  serviceId: z.string().uuid(),
  isActive: z.boolean(),
})

export const deleteConnectedServiceSchema = z.object({
  serviceId: z.string().uuid(),
})

export const revokeServiceCredentialSchema = z.object({
  credentialId: z.string().uuid(),
})

export const rotateWebhookSecretSchema = z.object({
  serviceId: z.string().uuid(),
})

export const createDevelopmentPaymentSchema = z.object({
  serviceId: z.string().uuid(),
  amount: z
    .string()
    .trim()
    .regex(
      /^[1-9]\d{0,17}$/,
      "Enter a positive whole Rial integer without decimals."
    ),
  description: z
    .string()
    .trim()
    .min(2, "Description must be at least 2 characters.")
    .max(500),
  externalOrderId: z.string().trim().max(191).optional().or(z.literal("")),
})

export const simulateDevelopmentResultSchema = z.object({
  paymentId: z.string().uuid(),
  outcome: z.enum(["success", "failure"]),
})

export type CreateConnectedServiceInput = z.infer<
  typeof createConnectedServiceSchema
>
export type IssueServiceCredentialInput = z.infer<
  typeof issueServiceCredentialSchema
>
export type CreateDevelopmentPaymentInputForm = z.infer<
  typeof createDevelopmentPaymentSchema
>
export type SimulateDevelopmentResultInput = z.infer<
  typeof simulateDevelopmentResultSchema
>

import { z } from "zod"

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

const metadataSchema = z.record(z.string(), z.unknown()).refine((value) => {
  try {
    return JSON.stringify(value).length <= 8 * 1024
  } catch {
    return false
  }
}, "Metadata must be JSON and no larger than 8 KB.")

export const createPaymentRequestSchema = z
  .object({
    externalOrderId: z.string().min(1).max(191),
    amount: z
      .string()
      .trim()
      .regex(
        /^[1-9]\d{0,17}$/,
        "Amount must be a positive whole Rial integer without decimals."
      ),
    currency: z.literal("IRR"),
    description: z.string().trim().min(1).max(500),
    returnUrl: httpUrlSchema.optional(),
    metadata: metadataSchema.optional(),
    simulator: z.boolean().optional(),
    gateway: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]{1,40}$/, "Use a gateway code from GET /gateways.")
      .optional(),
    customer: z
      .object({
        mobile: z
          .string()
          .trim()
          .regex(
            /^(\+98|0098|98|0)?9\d{9}$/,
            "Enter an Iranian mobile number such as 09121234567."
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(191)
  .regex(
    /^[\x21-\x7E]+$/,
    "Idempotency-Key must contain visible ASCII characters only."
  )

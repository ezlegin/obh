import { z } from "zod"

const isoDate = z.string().datetime({ offset: true })

const paymentSnapshotSchema = z
  .object({
    reference: z.string().min(1).max(64),
    orderId: z.string().min(1).max(160),
    attempt: z.number().int().min(1).max(10_000),
    gateway: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    gatewayOrderId: z.string().min(1).max(64),
    amount: z
      .string()
      .regex(
        /^[1-9]\d{0,17}$/,
        "Amount must be a positive whole Rial integer without decimals."
      ),
    currency: z.literal("IRR"),
    status: z.enum(["pending", "completed", "failed", "cancelled", "expired"]),
    environment: z.enum(["live", "test"]),
    description: z.string().trim().min(1).max(500),
    providerReference: z.string().max(191).nullable(),
    traceNumber: z.string().max(64).nullable(),
    maskedCardNumber: z.string().max(32).nullable(),
    resultCode: z.number().int().nullable(),
    resultText: z.string().max(2000).nullable(),
    installment: z
      .object({
        purchaseType: z.enum(["BNPL", "CREDIT"]),
        count: z.number().int().min(1).max(60).nullable(),
      })
      .nullable(),
    createdAt: isoDate,
    callbackReceivedAt: isoDate.nullable(),
    completedAt: isoDate.nullable(),
    failedAt: isoDate.nullable(),
    metadata: z
      .record(z.string(), z.unknown())
      .refine((value) => JSON.stringify(value).length <= 8 * 1024, {
        message: "Metadata must be no larger than 8 KB.",
      })
      .optional(),
  })
  .strict()

/**
 * Events a connected service sends to OBH. `payment.snapshot` carries the
 * full state of one payment attempt and is upserted by
 * `(service, reference)`, so duplicates and reordering are harmless.
 */
export const financeEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("payment.snapshot"),
      eventId: z.string().min(1).max(191),
      sentAt: isoDate,
      data: paymentSnapshotSchema,
    })
    .strict(),
])

export type FinanceEventInput = z.infer<typeof financeEventSchema>
export type PaymentSnapshotInput = z.infer<typeof paymentSnapshotSchema>

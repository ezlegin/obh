import { z } from "zod"

const uuidSchema = z.string().uuid()
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    )
  }, "Enter a valid date.")

const positiveAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,18}(?:\.\d{1,2})?$/, "Enter a valid amount.")
  .refine(
    (value) => !/^0+(?:\.0{1,2})?$/.test(value),
    "Amount must be greater than zero."
  )

const balanceSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,18}(?:\.\d{1,2})?$/, "Enter a valid balance.")

export const recordProviderFeeSchema = z.object({
  providerAccountId: uuidSchema,
  paymentId: z.union([uuidSchema, z.literal("")]).optional(),
  kind: z.enum(["GATEWAY_FEE", "COMMISSION"]),
  status: z.enum(["PENDING", "SETTLED"]),
  amount: positiveAmountSchema,
  chargedAt: dateOnlySchema,
  reference: z.string().trim().max(191).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
})

export const recordSettlementSchema = z.object({
  providerAccountId: uuidSchema,
  toAccountId: uuidSchema,
  amount: positiveAmountSchema,
  occurredAt: dateOnlySchema,
  externalReference: z.string().trim().max(191).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
})

export const recordReconciliationSchema = z.object({
  accountId: uuidSchema,
  actualBalance: balanceSchema,
  asOf: dateOnlySchema,
  note: z.string().trim().max(1000).optional().or(z.literal("")),
})

export type RecordProviderFeeInput = z.infer<typeof recordProviderFeeSchema>
export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>
export type RecordReconciliationInput = z.infer<
  typeof recordReconciliationSchema
>

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

const percentageSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(?:\.\d{1,4})?$/, "Use a percentage with up to 4 decimals.")
  .refine((value) => {
    const parsed = Number(value)
    return parsed > 0 && parsed <= 100
  }, "Percentage must be greater than 0 and at most 100.")

const nonNegativeAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,18}(?:\.\d{1,2})?$/, "Enter a valid amount.")

export const createShareholderSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z
    .union([z.string().trim().email("Enter a valid email."), z.literal("")])
    .optional(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const updateShareholderSchema = createShareholderSchema.extend({
  shareholderId: uuidSchema,
})

export const toggleShareholderSchema = z.object({
  shareholderId: uuidSchema,
  isActive: z.boolean(),
})

export const createOwnershipRecordSchema = z
  .object({
    shareholderId: uuidSchema,
    percentage: percentageSchema,
    effectiveFrom: dateOnlySchema,
    effectiveTo: z.union([dateOnlySchema, z.literal("")]).optional(),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((values, context) => {
    if (values.effectiveTo && values.effectiveTo < values.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "End date cannot be before the effective date.",
      })
    }
  })

export const endOwnershipRecordSchema = z.object({
  ownershipRecordId: uuidSchema,
  effectiveTo: dateOnlySchema,
})

export const calculateProfitPeriodSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Choose a month."),
  reserveAmount: nonNegativeAmountSchema,
  taxAmount: nonNegativeAmountSchema,
  adjustmentNote: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const approveProfitPeriodSchema = z.object({
  profitPeriodId: uuidSchema,
})

export const recordShareholderPayoutSchema = z.object({
  profitDistributionId: uuidSchema,
  accountId: uuidSchema,
  externalReference: z.string().trim().max(191).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
})

export type CreateShareholderInput = z.infer<typeof createShareholderSchema>
export type UpdateShareholderInput = z.infer<typeof updateShareholderSchema>
export type CreateOwnershipRecordInput = z.infer<
  typeof createOwnershipRecordSchema
>
export type CalculateProfitPeriodInput = z.infer<
  typeof calculateProfitPeriodSchema
>

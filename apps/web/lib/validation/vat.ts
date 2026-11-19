import { z } from "zod"

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    )
  }, "Enter a valid date.")

export const saveVatProfileSchema = z.object({
  stage: z.number().int().min(1).max(10),
  effectiveFrom: dateOnlySchema,
  economicCode: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const fileVatReturnSchema = z.object({
  year: z.number().int().min(1390).max(1500),
  quarter: z.number().int().min(1).max(4),
  reference: z.string().trim().max(191).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const markVatReturnPaidSchema = z.object({
  returnId: z.string().uuid(),
  reference: z.string().trim().max(191).optional().or(z.literal("")),
})

export const deleteVatReturnSchema = z.object({
  returnId: z.string().uuid(),
})

export type SaveVatProfileInput = z.infer<typeof saveVatProfileSchema>
export type FileVatReturnInput = z.infer<typeof fileVatReturnSchema>
export type MarkVatReturnPaidInput = z.infer<typeof markVatReturnPaidSchema>

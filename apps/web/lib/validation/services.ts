import { z } from "zod"

const uuidSchema = z.string().uuid()
const percentageSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(?:\.\d{1,4})?$/, "Enter a percentage between 0 and 100.")
  .refine((value) => Number(value) >= 0 && Number(value) <= 100, {
    message: "Enter a percentage between 0 and 100.",
  })

export const setServiceOwnershipSchema = z
  .object({
    serviceId: uuidSchema,
    shares: z
      .array(
        z.object({
          shareholderId: uuidSchema,
          percentage: percentageSchema,
        })
      )
      .max(100),
  })
  .superRefine((values, context) => {
    const seen = new Set<string>()
    let total = 0

    for (const share of values.shares) {
      if (seen.has(share.shareholderId)) {
        context.addIssue({
          code: "custom",
          path: ["shares"],
          message: "Each shareholder may only appear once.",
        })
        return
      }
      seen.add(share.shareholderId)
      total += Number(share.percentage)
    }

    if (total > 0 && Math.abs(total - 100) > 0.0001) {
      context.addIssue({
        code: "custom",
        path: ["shares"],
        message: `Service ownership must total exactly 100%, received ${total.toFixed(4)}%.`,
      })
    }
  })

export const calculateServiceProfitSchema = z.object({
  serviceId: uuidSchema,
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use a YYYY-MM month."),
})

export const deleteServiceProfitPeriodSchema = z.object({
  serviceProfitPeriodId: uuidSchema,
})

export type SetServiceOwnershipInput = z.infer<typeof setServiceOwnershipSchema>
export type CalculateServiceProfitInput = z.infer<
  typeof calculateServiceProfitSchema
>

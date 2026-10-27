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

const balanceAmountSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,18}(?:\.\d{1,2})?$/, "Enter a valid opening balance.")

export const createExpenseSchema = z.object({
  categoryId: uuidSchema,
  accountId: z.union([uuidSchema, z.literal("")]).optional(),
  serviceId: z.union([uuidSchema, z.literal("")]).optional(),
  amount: positiveAmountSchema,
  spentOn: dateOnlySchema,
  description: z.string().trim().min(2).max(500),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  externalReference: z.string().trim().max(191).optional().or(z.literal("")),
})

export const markExpensePaidSchema = z.object({
  expenseId: uuidSchema,
  accountId: uuidSchema,
})

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  requiresDocument: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
})

export const toggleExpenseCategorySchema = z.object({
  categoryId: uuidSchema,
  isActive: z.boolean(),
})

export const createRecurringExpenseSchema = z
  .object({
    categoryId: uuidSchema,
    accountId: z.union([uuidSchema, z.literal("")]).optional(),
    serviceId: z.union([uuidSchema, z.literal("")]).optional(),
    amount: positiveAmountSchema,
    description: z.string().trim().min(2).max(500),
    frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    intervalCount: z.number().int().min(1).max(24),
    startOn: dateOnlySchema,
    endOn: z.union([dateOnlySchema, z.literal("")]).optional(),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((values, context) => {
    if (values.endOn && values.endOn < values.startOn) {
      context.addIssue({
        code: "custom",
        path: ["endOn"],
        message: "End date cannot be before the start date.",
      })
    }
  })

export const recurringExpenseActionSchema = z.object({
  recurringExpenseId: uuidSchema,
  action: z.enum(["approve", "pause", "resume", "end"]),
})

export const generateRecurringExpenseSchema = z.object({
  recurringExpenseId: uuidSchema,
})

export const createIncomeSchema = z.object({
  accountId: z.union([uuidSchema, z.literal("")]).optional(),
  serviceId: z.union([uuidSchema, z.literal("")]).optional(),
  amount: positiveAmountSchema,
  receivedOn: dateOnlySchema,
  description: z.string().trim().min(2).max(500),
  source: z.string().trim().max(160).optional().or(z.literal("")),
  externalReference: z.string().trim().max(191).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const createBusinessAccountSchema = z.object({
  name: z.string().trim().min(2).max(160),
  institution: z.string().trim().max(160).optional().or(z.literal("")),
  maskedIdentifier: z.string().trim().max(80).optional().or(z.literal("")),
  openingBalance: balanceAmountSchema,
  openingBalanceAt: z.union([dateOnlySchema, z.literal("")]).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const toggleBusinessAccountSchema = z.object({
  accountId: uuidSchema,
  isActive: z.boolean(),
})

export const deleteExpenseDocumentSchema = z.object({
  documentId: uuidSchema,
})

export const deleteExpenseSchema = z.object({
  expenseId: uuidSchema,
})

export const deleteExpenseCategorySchema = z.object({
  categoryId: uuidSchema,
})

export const deleteRecurringExpenseSchema = z.object({
  recurringExpenseId: uuidSchema,
})

export const deleteIncomeSchema = z.object({
  incomeId: uuidSchema,
})

export const deleteBusinessAccountSchema = z.object({
  accountId: uuidSchema,
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type MarkExpensePaidInput = z.infer<typeof markExpensePaidSchema>
export type CreateExpenseCategoryInput = z.infer<
  typeof createExpenseCategorySchema
>
export type CreateRecurringExpenseInput = z.infer<
  typeof createRecurringExpenseSchema
>
export type RecurringExpenseActionInput = z.infer<
  typeof recurringExpenseActionSchema
>
export type CreateIncomeInput = z.infer<typeof createIncomeSchema>
export type CreateBusinessAccountInput = z.infer<
  typeof createBusinessAccountSchema
>

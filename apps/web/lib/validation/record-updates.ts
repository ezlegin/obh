import { z } from "zod"

import {
  createBusinessAccountSchema,
  createExpenseSchema,
  createIncomeSchema,
} from "@/lib/validation/accounting"
import {
  recordProviderFeeSchema,
  recordReconciliationSchema,
  recordSettlementSchema,
} from "@/lib/validation/reconciliation"

const uuidSchema = z.string().uuid()

export const updateExpenseSchema = createExpenseSchema.extend({
  expenseId: uuidSchema,
})

export const updateIncomeSchema = createIncomeSchema.extend({
  incomeId: uuidSchema,
})

export const updateBusinessAccountSchema = createBusinessAccountSchema.extend({
  accountId: uuidSchema,
})

export const updateProviderFeeSchema = recordProviderFeeSchema.extend({
  feeId: uuidSchema,
})

export const updateSettlementSchema = recordSettlementSchema.extend({
  transferId: uuidSchema,
})

export const updateReconciliationSchema = recordReconciliationSchema.extend({
  reconciliationId: uuidSchema,
})

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>
export type UpdateBusinessAccountInput = z.infer<
  typeof updateBusinessAccountSchema
>
export type UpdateProviderFeeInput = z.infer<typeof updateProviderFeeSchema>
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>
export type UpdateReconciliationInput = z.infer<
  typeof updateReconciliationSchema
>

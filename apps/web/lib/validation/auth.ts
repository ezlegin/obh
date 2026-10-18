import { z } from "zod"

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.")

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
})

export const loginActionSchema = loginSchema.extend({
  callbackUrl: z.string().max(2048).optional(),
})

export const managerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(160, "Name must be 160 characters or fewer."),
  email: emailSchema,
  password: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .max(72, "Password must be 72 characters or fewer."),
})

export type LoginInput = z.infer<typeof loginSchema>
export type LoginActionInput = z.infer<typeof loginActionSchema>
export type ManagerInput = z.infer<typeof managerSchema>

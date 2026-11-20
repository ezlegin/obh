import { z } from "zod"

/** A service's order id in the URL (`@obhco/pay` `orderId`). */
export const orderIdSchema = z.string().trim().min(1).max(160)

/** کد ملی: 10 digits with its check digit. */
export function isValidNationalCode(value: string) {
  if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) return false
  const digits = value.split("").map(Number)
  const sum = digits.slice(0, 9).reduce((total, digit, index) => total + digit * (10 - index), 0)
  const remainder = sum % 11
  const check = digits[9]
  return remainder < 2 ? check === remainder : check === 11 - remainder
}

/** Buyer details for an official (type-1) invoice, sent by a service. */
export const invoiceBuyerSchema = z
  .object({
    buyerType: z.enum(["person", "company"]),
    name: z.string().trim().min(2).max(160),
    nationalId: z.string().regex(/^\d{10,11}$/, "nationalId must be 10 or 11 digits."),
    economicCode: z
      .string()
      .regex(/^\d{11,14}$/, "economicCode must be 11 to 14 digits.")
      .nullish(),
    postalCode: z.string().regex(/^\d{10}$/, "postalCode must be 10 digits."),
    phone: z.string().regex(/^0\d{9,10}$/, "phone must start with 0 and have 10 or 11 digits."),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.buyerType === "person" && !isValidNationalCode(value.nationalId)) {
      context.addIssue({
        code: "custom",
        path: ["nationalId"],
        message: "nationalId is not a valid کد ملی.",
      })
    }
    if (value.buyerType === "company" && !/^\d{11}$/.test(value.nationalId)) {
      context.addIssue({
        code: "custom",
        path: ["nationalId"],
        message: "A company's nationalId (شناسه ملی) has 11 digits.",
      })
    }
  })

export const stuffIdFormSchema = z.object({
  serviceId: z.string().uuid(),
  stuffId: z.string().trim().regex(/^\d{13}$/, "The service id must be 13 digits."),
})

export const serviceIdFormSchema = z.object({ serviceId: z.string().uuid() })

export const taxInvoiceIdSchema = z.object({ invoiceId: z.string().uuid() })

"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/guards"
import {
  serviceIdFormSchema,
  stuffIdFormSchema,
  taxInvoiceIdSchema,
} from "@/lib/validation/tax-invoices"
import { DomainError } from "@/server/errors"
import {
  checkTaxInvoice,
  registerServiceTaxStuffId,
  resendTaxInvoice,
  runTaxInvoiceSync,
  setServiceTaxStuffId,
} from "@/server/tax-invoices/service"

export type TaxInvoiceActionResult = { ok: boolean; error?: string; message?: string }

async function run(
  action: () => Promise<string | void>,
  fallback: string
): Promise<TaxInvoiceActionResult> {
  try {
    const message = await action()
    revalidatePath("/admin/tax-invoices")
    return { ok: true, ...(message ? { message } : {}) }
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message }
    console.error("Tax invoice action failed.", error instanceof Error ? error.name : "Unknown")
    return { ok: false, error: fallback }
  }
}

export async function syncTaxInvoicesAction(): Promise<TaxInvoiceActionResult> {
  const admin = await requireAdmin()
  return run(async () => {
    const result = await runTaxInvoiceSync(admin.id)
    if (result.status !== "done") return
    const summary = `Created ${result.created}, sent ${result.sent}, issued ${result.issued}, failed ${result.failed}.`
    return result.error ? `${summary} Stopped early: ${result.error}` : summary
  }, "The sync could not be run.")
}

export async function resendTaxInvoiceAction(input: unknown): Promise<TaxInvoiceActionResult> {
  const admin = await requireAdmin()
  const parsed = taxInvoiceIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid invoice." }
  return run(async () => {
    const invoice = await resendTaxInvoice(admin.id, parsed.data.invoiceId)
    return invoice.status === "FAILED"
      ? `Kisan refused it: ${invoice.lastError ?? "see the row."}`
      : invoice.status === "SENT"
        ? "Accepted by Kisan."
        : (invoice.lastError ?? undefined)
  }, "The invoice could not be sent.")
}

export async function checkTaxInvoiceAction(input: unknown): Promise<TaxInvoiceActionResult> {
  await requireAdmin()
  const parsed = taxInvoiceIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid invoice." }
  return run(async () => {
    const invoice = await checkTaxInvoice(parsed.data.invoiceId)
    return invoice.status === "ISSUED"
      ? `Issued: ${invoice.taxId ?? ""}`
      : (invoice.lastError ?? `Still ${invoice.status.toLowerCase()}.`)
  }, "Kisan could not be asked.")
}

export async function saveServiceTaxStuffIdAction(input: unknown): Promise<TaxInvoiceActionResult> {
  const admin = await requireAdmin()
  const parsed = stuffIdFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid service id." }
  }
  return run(
    () => setServiceTaxStuffId(admin.id, parsed.data.serviceId, parsed.data.stuffId).then(() => {}),
    "The service id could not be saved."
  )
}

export async function registerServiceTaxStuffIdAction(input: unknown): Promise<TaxInvoiceActionResult> {
  const admin = await requireAdmin()
  const parsed = serviceIdFormSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid service." }
  return run(
    async () => {
      await registerServiceTaxStuffId(admin.id, parsed.data.serviceId)
      return "Registered at Kisan."
    },
    "The service id could not be registered."
  )
}

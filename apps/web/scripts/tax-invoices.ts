/**
 * Electronic invoices for سامانه مودیان, run on a schedule (deploy/crontab):
 *
 *   pnpm --filter web tax-invoices
 *
 * Creates the invoices LIVE sales are missing, sends pending ones to Kisan
 * and checks sent ones (server/tax-invoices/service.ts). Does nothing until
 * KISAN_* and the VAT registration date are set.
 */
import { config } from "dotenv"

config({ path: ".env.local", quiet: true })
config({ quiet: true })

const { syncTaxInvoices } = await import("../server/tax-invoices/service")
const { getDb } = await import("../lib/db/client")

try {
  const result = await syncTaxInvoices()
  if (result.status === "off") {
    console.log(`tax-invoices (off): ${result.reason}`)
  } else {
    console.log(
      `tax-invoices: created ${result.created}, sent ${result.sent}, issued ${result.issued}, failed ${result.failed}` +
        (result.error ? `; stopped early: ${result.error}` : "")
    )
    if (result.error) process.exitCode = 1
  }
} catch (error) {
  console.error("tax-invoices failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await getDb().$disconnect()
}

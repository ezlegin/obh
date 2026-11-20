import assert from "node:assert/strict"
import test from "node:test"

import { buildKisanInvoice, invoiceAmounts } from "../lib/tax-invoices/build"
import { invoiceBuyerSchema, isValidNationalCode } from "../lib/validation/tax-invoices"

test("splits a VAT-inclusive Rial amount into price and 10% VAT", () => {
  assert.deepEqual(invoiceAmounts(1_100_000n, 10), {
    net: 1_000_000n,
    vat: 100_000n,
    total: 1_100_000n,
  })
})

test("stays within one Rial of what was paid", () => {
  for (const gross of [10_000n, 499_000n, 555_550n, 2_550_000n, 15_999_990n, 1n]) {
    for (const rate of [9, 10]) {
      const { net, vat, total } = invoiceAmounts(gross, rate)
      assert.equal(vat, (net * BigInt(rate) * 2n + 100n) / 200n)
      const difference = total > gross ? total - gross : gross - total
      assert.ok(difference <= 1n, `${gross} at ${rate}%: total ${total}`)
    }
  }
})

const base = {
  number: 42,
  uniqueId: "0190f3c4-0000-7000-8000-000000000001",
  stuffId: "2330001423071",
  title: "Afarin AI: Credit pack",
  grossRials: 1_100_000n,
  vatPercent: 10,
  paidAt: new Date("2026-11-19T10:30:00Z"),
  isUpdate: false,
}

test("a sale without a buyer is a type-2 invoice with no buyer fields", () => {
  const invoice = buildKisanInvoice({ ...base, buyer: null })
  assert.equal(invoice.invoiceType, 2)
  assert.equal(invoice.invoiceNumber, "42")
  assert.equal(invoice.invoiceTime, "14:00:00")
  assert.equal("buyerNationalCode" in invoice, false)
  assert.deepEqual(
    {
      commodityCode: invoice.invoiceItems[0]?.commodityCode,
      unitPrice: invoice.invoiceItems[0]?.unitPrice,
      taxPercent: invoice.invoiceItems[0]?.taxPercent,
      paid: invoice.invoicePayments[0]?.paymentAmount,
      method: invoice.invoicePayments[0]?.paymentMethod,
    },
    { commodityCode: "2330001423071", unitPrice: 1_000_000, taxPercent: 10, paid: 1_100_000, method: 5 }
  )
})

test("a company buyer makes a type-1 invoice with its شناسه ملی as economic code", () => {
  const invoice = buildKisanInvoice({
    ...base,
    buyer: {
      buyerType: 2,
      name: "شرکت نمونه",
      nationalId: "10101234567",
      economicCode: null,
      postalCode: "1234567890",
      phone: "02112345678",
    },
  })
  assert.equal(invoice.invoiceType, 1)
  assert.equal(invoice.buyerType, 2)
  assert.equal(invoice.buyerCompanyName, "شرکت نمونه")
  assert.equal(invoice.buyerEconomicCode, "10101234567")
})

test("a person buyer is split into first and last name", () => {
  const invoice = buildKisanInvoice({
    ...base,
    buyer: {
      buyerType: 1,
      name: "علی رضا احمدی",
      nationalId: "0012345679",
      economicCode: null,
      postalCode: "1234567890",
      phone: "09121234567",
    },
  })
  assert.equal(invoice.buyerFirstName, "علی رضا")
  assert.equal(invoice.buyerLastName, "احمدی")
  assert.equal(invoice.buyerEconomicCode, null)
})

test("buyer details are validated", () => {
  assert.equal(isValidNationalCode("0012345679"), true)
  assert.equal(isValidNationalCode("0012345678"), false)
  assert.equal(isValidNationalCode("1111111111"), false)

  const company = {
    buyerType: "company",
    name: "شرکت نمونه",
    nationalId: "10101234567",
    postalCode: "1234567890",
    phone: "02112345678",
  }
  assert.equal(invoiceBuyerSchema.safeParse(company).success, true)
  assert.equal(invoiceBuyerSchema.safeParse({ ...company, nationalId: "0012345679" }).success, false)
  assert.equal(invoiceBuyerSchema.safeParse({ ...company, extra: 1 }).success, false)
})

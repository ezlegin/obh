/**
 * Pure rules for electronic invoices sent to سامانه مودیان through Kisan
 * (API v8.7.3, «ثبت صورتحساب با استفاده از API»): the Rial amounts inside a
 * VAT-inclusive sale and Kisan's JSON for one invoice. No I/O.
 */

/** Kisan's code for the Iranian Rial (its «moneytype» list). */
const RIAL = 364
/** «عدد» in the tax system's unit list. */
const UNIT_EACH = 1627
/** «درگاه پرداخت اینترنتی» in Kisan's payment methods. */
const PAYMENT_GATEWAY = 5

export const STUFF_ID_PATTERN = /^\d{13}$/

/**
 * The line price without VAT, the VAT, and the total the tax system will
 * compute from them, for a VAT-inclusive whole-Rial amount. The total can
 * differ from what was paid by at most one Rial (rounding).
 */
export function invoiceAmounts(grossRials: bigint, ratePercent: number) {
  const rate = BigInt(ratePercent)
  const divisor = 100n + rate
  // Half-up rounding of gross × 100 / (100 + rate) and of net × rate / 100.
  const net = (grossRials * 200n + divisor) / (divisor * 2n)
  const vat = (net * rate * 2n + 100n) / 200n
  return { net, vat, total: net + vat }
}

export type InvoiceBuyerInput = {
  /** 1 person, 2 company. */
  buyerType: 1 | 2
  name: string
  nationalId: string
  economicCode: string | null
  postalCode: string
  phone: string
}

export type InvoiceInput = {
  number: number
  uniqueId: string
  /** Tax-system id of the service sold (also our commodity code at Kisan). */
  stuffId: string
  /** Shown on the invoice line. */
  title: string
  grossRials: bigint
  vatPercent: number
  paidAt: Date
  /** Null for a type-2 invoice. */
  buyer: InvoiceBuyerInput | null
  /** True when Kisan already holds this invoice and should edit it. */
  isUpdate: boolean
}

const tehranTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tehran",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return { first: null, last: parts[0] ?? null }
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) ?? null }
}

function buyerFields(buyer: InvoiceBuyerInput) {
  const company = buyer.buyerType === 2
  const name = splitName(buyer.name)
  return {
    buyerType: buyer.buyerType,
    buyerNationalCode: buyer.nationalId,
    // A company's شناسه ملی is also its economic number when it gave none.
    buyerEconomicCode: company ? buyer.economicCode || buyer.nationalId : buyer.economicCode,
    buyerCompanyName: company ? buyer.name : null,
    buyerFirstName: company ? null : name.first,
    buyerLastName: company ? null : name.last,
    buyerPostalCode: buyer.postalCode,
    buyerPhoneNumber: buyer.phone,
  }
}

/** Kisan's JSON for a sale (pattern 1, subject «اصلی»), type 1 with a buyer or type 2. */
export function buildKisanInvoice(input: InvoiceInput) {
  const { net, total } = invoiceAmounts(input.grossRials, input.vatPercent)
  return {
    invoiceNumber: String(input.number),
    invoiceDate: input.paidAt.toISOString(),
    invoiceTime: tehranTime.format(input.paidAt),
    invoicePattern: 1,
    invoiceType: input.buyer ? 1 : 2,
    invoiceSubject: 1,
    paymentType: 1,
    creditPaymentAmount: 0,
    referenceTaxSerialNumber: null,
    uniqueId: input.uniqueId,
    ...(input.buyer ? buyerFields(input.buyer) : {}),
    description: input.title,
    isUpdate: input.isUpdate,
    invoiceItems: [
      {
        commodityCode: input.stuffId,
        extendStuffTitle: input.title,
        amount: 1,
        unitType: UNIT_EACH,
        moneyType: RIAL,
        equivalentToRial: 1,
        unitPrice: Number(net),
        discount: 0,
        taxPercent: input.vatPercent,
      },
    ],
    invoicePayments: [
      {
        paymentMethod: PAYMENT_GATEWAY,
        paymentAmount: Number(total),
        paymentDate: input.paidAt.toISOString(),
      },
    ],
  }
}

/** Kisan's invoice statuses (its list 7). */
export const KISAN_STATUS_LABELS: Record<number, string> = {
  1: "Rejected: service id not registered at Kisan",
  2: "Rejected: duplicate invoice",
  3: "Accepted by Kisan",
  4: "Seller confirmation withdrawn",
  8: "Sending to the tax system",
  9: "Queued at the tax system",
  10: "Under review by Kisan",
  12: "Queued for resending",
  14: "In the tax workspace",
  15: "Referenced by a correction",
  16: "Referenced by a sales return",
  17: "Revoked",
  18: "Needs review",
  19: "Archived",
}

/** Tax-system error codes behind Kisan status 18 (its list 12). */
export const TAX_ERROR_LABELS: Record<string, string> = {
  "04111": "The memory id is not assigned to Kisan (no trusted-company contract found).",
  "04132": "Kisan's signing certificate may not issue for this memory id.",
  "04134": "The signing trusted company was not found or is inactive.",
  "0300101": "The invoice tax number does not match the tax system.",
  "0300601": "The referenced invoice tax number does not match the tax system.",
  "0300901": "The seller economic code does not match the tax system.",
  "0300902": "The seller differs from the referenced invoice's seller.",
  "0303301": "The goods/service id does not match the tax system.",
  "0304401": "The VAT rate does not match the tax system.",
  "02045": "The VAT amount fails the tax system's calculation rules.",
  "02002": "The invoice date and time are not valid.",
}

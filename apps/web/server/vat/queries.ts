import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import {
  formatVatQuarterLabel,
  vatQuartersBetween,
  vatRateOn,
} from "@/lib/vat/rules"
import {
  formatDateOnly,
  todayDateOnlyInTehran,
} from "@/server/accounting/dates"
import { formatPersianDate } from "@/server/payments/installments/schedule"
import { computeVatTotals } from "@/server/vat/totals"

export type VatQuarterStatus = "open" | "due" | "overdue" | "filed" | "paid"

export type VatQuarterRow = {
  year: number
  quarter: number
  label: string
  startsOn: string
  endsOn: string
  dueOn: string
  periodPersian: string
  dueOnPersian: string
  ratePercent: number
  status: VatQuarterStatus
  /** Whether the figures are frozen on a filed return or live estimates. */
  frozen: boolean
  returnId: string | null
  reference: string | null
  taxableSales: string
  outputVat: string
  purchases: string
  inputVat: string
  netVat: string
  /** Credit carried in from earlier quarters with more input than output VAT. */
  creditBroughtForward: string
  /** What is actually owed after applying carried credit. */
  payable: string
}

export type VatWorkspace = {
  today: string
  todayPersian: string
  currentRatePercent: number
  profile: {
    stage: number
    effectiveFrom: string
    effectiveFromPersian: string
    economicCode: string | null
    notes: string | null
  } | null
  quarters: VatQuarterRow[]
  nextDeadline: {
    label: string
    dueOn: string
    dueOnPersian: string
    daysLeft: number
    payable: string
    overdue: boolean
  } | null
}

function daysBetween(fromDateOnly: string, toDateOnly: string) {
  return Math.round(
    (Date.parse(`${toDateOnly}T00:00:00Z`) -
      Date.parse(`${fromDateOnly}T00:00:00Z`)) /
      86_400_000
  )
}

export async function getVatWorkspace(): Promise<VatWorkspace> {
  const db = getDb()
  const today = todayDateOnlyInTehran()
  const zero = new Prisma.Decimal(0)

  const [profileRow, returns] = await Promise.all([
    db.vatProfile.findUnique({ where: { id: "default" } }),
    db.vatReturn.findMany(),
  ])

  const base = {
    today,
    todayPersian: formatPersianDate(today),
    currentRatePercent: vatRateOn(today),
  }

  if (!profileRow) {
    return { ...base, profile: null, quarters: [], nextDeadline: null }
  }

  const effectiveFrom = formatDateOnly(profileRow.effectiveFrom)
  const returnsByQuarter = new Map(
    returns.map((row) => [`${row.year}-${row.quarter}`, row])
  )
  const quarters = vatQuartersBetween(
    effectiveFrom,
    today < effectiveFrom ? effectiveFrom : today
  )

  const figures = await Promise.all(
    quarters.map(async (quarter) => {
      const filed = returnsByQuarter.get(`${quarter.year}-${quarter.quarter}`)
      if (filed) {
        return {
          filed,
          taxableSales: filed.taxableSales,
          outputVat: filed.outputVat,
          purchases: filed.purchases,
          inputVat: filed.inputVat,
        }
      }
      const totals = await computeVatTotals({
        startsOn: quarter.startsOn,
        endsOn: quarter.endsOn,
        effectiveFrom,
      })
      return {
        filed: null,
        taxableSales: totals.taxableSales,
        outputVat: totals.outputVat,
        purchases: totals.purchases,
        inputVat: totals.inputVat,
      }
    })
  )

  let credit = zero
  const rows: VatQuarterRow[] = quarters.map((quarter, index) => {
    const figure = figures[index]!
    const netVat = figure.outputVat.minus(figure.inputVat)
    const creditBroughtForward = credit
    const afterCredit = netVat.minus(credit)
    const payable = Prisma.Decimal.max(afterCredit, zero)
    credit = Prisma.Decimal.max(afterCredit.neg(), zero)

    const status: VatQuarterStatus = figure.filed
      ? figure.filed.status === "PAID"
        ? "paid"
        : "filed"
      : quarter.endsOn >= today
        ? "open"
        : today > quarter.dueOn
          ? "overdue"
          : "due"

    return {
      year: quarter.year,
      quarter: quarter.quarter,
      label: formatVatQuarterLabel(quarter.year, quarter.quarter),
      startsOn: quarter.startsOn,
      endsOn: quarter.endsOn,
      dueOn: quarter.dueOn,
      periodPersian: `${formatPersianDate(quarter.startsOn)} – ${formatPersianDate(quarter.endsOn)}`,
      dueOnPersian: formatPersianDate(quarter.dueOn),
      ratePercent: vatRateOn(quarter.startsOn),
      status,
      frozen: Boolean(figure.filed),
      returnId: figure.filed?.id ?? null,
      reference: figure.filed?.reference ?? null,
      taxableSales: figure.taxableSales.toFixed(2),
      outputVat: figure.outputVat.toFixed(2),
      purchases: figure.purchases.toFixed(2),
      inputVat: figure.inputVat.toFixed(2),
      netVat: netVat.toFixed(2),
      creditBroughtForward: creditBroughtForward.toFixed(2),
      payable: payable.toFixed(2),
    }
  })

  // The next return to deal with: the oldest finished quarter not yet paid,
  // otherwise the quarter in progress.
  const pending =
    rows.find((row) => row.status === "overdue" || row.status === "due") ??
    rows.find((row) => row.status === "filed") ??
    rows.find((row) => row.status === "open") ??
    null

  const nextDeadline = pending
    ? {
        label: pending.label,
        dueOn: pending.dueOn,
        dueOnPersian: pending.dueOnPersian,
        daysLeft: daysBetween(today, pending.dueOn),
        payable: pending.payable,
        overdue: today > pending.dueOn,
      }
    : null

  return {
    ...base,
    profile: {
      stage: profileRow.stage,
      effectiveFrom,
      effectiveFromPersian: formatPersianDate(effectiveFrom),
      economicCode: profileRow.economicCode,
      notes: profileRow.notes,
    },
    quarters: rows.reverse(),
    nextDeadline,
  }
}

/**
 * A dashboard alert when VAT is not set up, or when a finished quarter's
 * return is unfiled or unpaid. Quarters still in progress never alert.
 */
export async function getVatDashboardAlert(): Promise<{
  id: string
  title: string
  description: string
  severity: "warning" | "info"
} | null> {
  const workspace = await getVatWorkspace()

  if (!workspace.profile) {
    return {
      id: "alert-vat-profile",
      title: "VAT registration not set",
      description:
        "Record the VAT registration stage and date on the VAT page so collected VAT is kept out of revenue and quarterly returns are tracked.",
      severity: "info",
    }
  }

  const row = [...workspace.quarters]
    .reverse()
    .find(
      (quarter) =>
        quarter.status === "due" ||
        quarter.status === "overdue" ||
        (quarter.status === "filed" && quarter.payable !== "0.00")
    )

  if (!row) {
    return null
  }

  const daysLeft = daysBetween(workspace.today, row.dueOn)
  const owed = `${Number(row.payable).toLocaleString("en-US")} R`

  if (row.status === "filed") {
    return {
      id: `alert-vat-unpaid-${row.year}-${row.quarter}`,
      title: `VAT for ${row.label} is filed but not paid`,
      description: `${owed} is owed, due ${row.dueOnPersian}${daysLeft < 0 ? " (overdue)" : ""}.`,
      severity: "warning",
    }
  }

  return {
    id: `alert-vat-due-${row.year}-${row.quarter}`,
    title:
      row.status === "overdue"
        ? `VAT return for ${row.label} is overdue`
        : `VAT return for ${row.label} is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    description: `File the return (even if zero) by ${row.dueOnPersian}. Estimated amount owed: ${owed}.`,
    severity: row.status === "overdue" || daysLeft <= 10 ? "warning" : "info",
  }
}

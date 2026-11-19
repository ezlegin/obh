import "server-only"

import { Prisma } from "@/lib/generated/prisma/client"
import { getDb } from "@/lib/db/client"
import { formatDateOnly, parseDateOnly } from "@/server/accounting/dates"
import {
  addDaysToDateOnly,
  tehranStartOfDay,
  vatRateSegments,
} from "@/lib/vat/rules"
import { vatIncludedIn } from "@/server/vat/amounts"

const zero = () => new Prisma.Decimal(0)

export type VatTotals = {
  /** Gross (VAT-inclusive) LIVE gateway payments completed while registered. */
  paymentGross: Prisma.Decimal
  /** VAT inside those payments, at the statutory rate of each day. */
  paymentVat: Prisma.Decimal
  /** Gross manual income while registered and the VAT recorded on it. */
  incomeGross: Prisma.Decimal
  incomeVat: Prisma.Decimal
  /** Gross paid expenses while registered and their creditable input VAT. */
  expenseGross: Prisma.Decimal
  expenseVat: Prisma.Decimal
  outputVat: Prisma.Decimal
  inputVat: Prisma.Decimal
  /** Sales and purchases net of VAT, as declared on a return. */
  taxableSales: Prisma.Decimal
  purchases: Prisma.Decimal
}

export async function getVatEffectiveFrom() {
  const profile = await getDb().vatProfile.findUnique({
    where: { id: "default" },
    select: { effectiveFrom: true },
  })
  return profile ? formatDateOnly(profile.effectiveFrom) : null
}

/**
 * VAT for an inclusive range of Tehran calendar days, optionally for one
 * service. Only days on or after the registration date count: before it the
 * company is not a VAT collector, so nothing is split out.
 */
export async function computeVatTotals(input: {
  startsOn: string
  endsOn: string
  serviceId?: string
  effectiveFrom?: string | null
}): Promise<VatTotals> {
  const db = getDb()
  const effectiveFrom =
    input.effectiveFrom === undefined
      ? await getVatEffectiveFrom()
      : input.effectiveFrom
  const startsOn =
    effectiveFrom && effectiveFrom > input.startsOn
      ? effectiveFrom
      : input.startsOn

  const totals: VatTotals = {
    paymentGross: zero(),
    paymentVat: zero(),
    incomeGross: zero(),
    incomeVat: zero(),
    expenseGross: zero(),
    expenseVat: zero(),
    outputVat: zero(),
    inputVat: zero(),
    taxableSales: zero(),
    purchases: zero(),
  }

  if (!effectiveFrom || startsOn > input.endsOn) {
    return totals
  }

  const serviceFilter = input.serviceId ? { serviceId: input.serviceId } : {}
  const segments = vatRateSegments(startsOn, input.endsOn)

  const [payments, income, expenses] = await Promise.all([
    Promise.all(
      segments.map((segment) =>
        db.payment.aggregate({
          where: {
            ...serviceFilter,
            status: "COMPLETED",
            environment: "LIVE",
            currency: "IRR",
            completedAt: {
              gte: tehranStartOfDay(segment.startsOn),
              lt: tehranStartOfDay(addDaysToDateOnly(segment.endsOn, 1)),
            },
          },
          _sum: { amount: true },
        })
      )
    ),
    db.income.aggregate({
      where: {
        ...serviceFilter,
        currency: "IRR",
        receivedOn: {
          gte: parseDateOnly(startsOn),
          lte: parseDateOnly(input.endsOn),
        },
      },
      _sum: { amount: true, vatAmount: true },
    }),
    db.expense.aggregate({
      where: {
        ...serviceFilter,
        status: "PAID",
        currency: "IRR",
        spentOn: {
          gte: parseDateOnly(startsOn),
          lte: parseDateOnly(input.endsOn),
        },
      },
      _sum: { amount: true, vatAmount: true },
    }),
  ])

  payments.forEach((aggregate, index) => {
    const gross = aggregate._sum.amount ?? zero()
    totals.paymentGross = totals.paymentGross.plus(gross)
    totals.paymentVat = totals.paymentVat.plus(
      vatIncludedIn(gross, segments[index]!.ratePercent)
    )
  })

  totals.incomeGross = income._sum.amount ?? zero()
  totals.incomeVat = income._sum.vatAmount ?? zero()
  totals.expenseGross = expenses._sum.amount ?? zero()
  totals.expenseVat = expenses._sum.vatAmount ?? zero()

  totals.outputVat = totals.paymentVat.plus(totals.incomeVat)
  totals.inputVat = totals.expenseVat
  totals.taxableSales = totals.paymentGross
    .plus(totals.incomeGross)
    .minus(totals.outputVat)
  totals.purchases = totals.expenseGross.minus(totals.inputVat)

  return totals
}

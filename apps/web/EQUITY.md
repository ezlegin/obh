# OBH equity and profit distribution

Status: Step 8 implements shareholder records, historical ownership, monthly
profit calculation, approval, loss carryforward, and full shareholder payouts.

## Approved rules

1. **Period:** one calendar month at a time, interpreted on Asia/Tehran
   boundaries.
2. **Basis:** cash basis.
3. **Revenue:** gross completed **LIVE** payments plus manual income with a
   received date in the month.
4. **Deductions:** paid expenses, settled LIVE provider fees, and explicit
   manager-entered reserve and tax amounts.
5. **Ownership:** ownership effective on the period end date, snapshotted per
   shareholder, and required to total exactly `100.0000%` when distributable
   profit is positive.
6. **Approval:** one authorized manager explicitly approves the calculated
   period and all of its allocations; every step is audited.
7. **Rounding:** allocations are whole IRR. The remaining rounding residual stays
   unallocated.
8. **Losses:** a negative month creates a loss balance that is applied to future
   positive profit before distribution.
9. **Payout:** one full payout per shareholder allocation, against an active
   business payment source.
10. **TEST separation:** TEST payments are excluded from revenue and profit.

## Calculation

```text
totalRevenue  = completed LIVE payments (completedAt in month)
              + manual income (receivedOn in month)

netProfit     = totalRevenue
              − paid expenses (spentOn in month)
              − settled LIVE provider fees (chargedAt in month)
              − reserveAmount
              − taxAmount

distributable = max(0, netProfit − priorLossBalance)
lossApplied   = min(max(netProfit, 0), priorLossBalance)
lossAfter     = priorLossBalance − lossApplied       when netProfit ≥ 0
              = priorLossBalance + abs(netProfit)    when netProfit < 0
```

Pending expenses and pending provider fees are excluded from distributable
profit. Payment revenue uses the provider-verified `completedAt` timestamp.

## Ownership

- Ownership records have `effectiveFrom` and optional `effectiveTo`.
- Overlapping records for the same shareholder are rejected.
- A period snapshots the percentage for each shareholder in
  `ProfitDistribution.percentageSnapshot`.
- Ownership changes after approval cannot rewrite an existing period.
- Current ownership is shown as of today in the UI, but calculations use the
  period end date.

## Period lifecycle

- `DRAFT`: calculated, editable by recalculation.
- `APPROVED`: locked calculation and allocations; payouts can be recorded.
- `CLOSED`: all positive allocations paid, or the period had no distributable
  profit and was approved.
- `VOIDED`: reserved; no void workflow is implemented.

Periods must be calculated and approved chronologically. A later period cannot
exist while an earlier draft is unresolved, which keeps loss carryforward
consistent.

Approved periods are frozen snapshots. Late income, expense, fee, or ownership
entries do not silently rewrite them; record corrections in the appropriate
period instead.

## Payouts

- A payout must equal the full allocation and is linked to one active business
  account.
- The database allows only one payout per distribution.
- The period closes automatically once every positive allocation is paid.
- Payouts are accounting records. No bank transfer is executed by OBH, and no
  provider/account balance is automatically mutated by this step.
- A loss or zero-profit period has no payout rows.

## UI

- `/admin/shareholders` — profiles, ownership history, ending records.
- `/admin/distributions` — monthly calculation, allocations, approval, payout
  tracking, loss carryforward, and historical periods.

## Limitations

- No partial payouts; no payout retry workflow.
- No second-person approval.
- No tax engine; reserve and tax are explicit amounts.
- No dividend withholding or jurisdiction-specific tax logic.
- No automated bank payout.
- No formal revenue-recognition policy beyond the cash-basis rule above.
- Approved months are immutable by design; there is no reopen workflow.
- A payout does not write a `Transfer` automatically.

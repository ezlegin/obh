# OBH reports, exports, and reconciliation

Status: Step 9 implements filtered financial reports, CSV exports, provider
settlement tracking, gateway reconciliation, and cross-ledger consistency checks.

## Report range

- Date filters are inclusive: `from` and `to` are accounting dates.
- Default range is the current calendar month.
- Ledger boundaries use Asia/Tehran (`+03:30`); payment instants are compared
  against those boundaries.
- Invalid or reversed ranges fall back to the current month and show a warning.

## Report definitions

- **LIVE payment revenue:** completed LIVE payments with `completedAt` in range.
  TEST payments are excluded and reported separately as a review item.
- **Manual income:** income records with `receivedOn` in range.
- **Paid expenses:** expenses with `PAID` status and `spentOn` in range.
- **Pending expenses:** pending expenses in range, shown separately and excluded
  from operating totals.
- **Settled provider fees:** SETTLED LIVE provider fees with `chargedAt` in range.
- **Net operating:** LIVE payment revenue + manual income − paid expenses −
  settled LIVE provider fees.
- **Approved distributable:** approved/closed profit periods whose end date is in
  range.
- **Payouts paid:** completed payouts with `paidAt` in range.
- **TEST payments excluded:** completed TEST payments in range, informational and
  never included in financial totals.

## Exports

CSV exports are available for summary, LIVE payments, expenses, and
distributions.

- Exports require an active manager session.
- CSV text cells are quoted and formula-like values are neutralized.
- Numeric cells remain numeric.
- UTF-8 BOM is included for spreadsheet compatibility.
- Exports are not public and are generated from the same range as the report.

## Consistency checks

The report page evaluates:

- completed LIVE payments have verification evidence;
- completed LIVE payments are linked to a provider account;
- LIVE payments use IRR;
- provider references are not duplicated;
- paid expenses have a paid timestamp and a payment source;
- document-required expenses have at least one document;
- allocation rows plus retained residual equal distributable profit;
- profitable approved periods have allocations;
- closed periods have no unpaid allocations;
- approved allocations carry approval timestamps;
- profitable periods snapshot exactly 100% ownership;
- payout amounts equal allocations and mark them paid;
- income and expenses use IRR;
- latest LIVE provider reconciliations have zero difference;
- TEST payments are excluded from reports.

`TEST payments are excluded` is intentionally a **review** item when test
activity exists, not a failure.

## Provider reconciliation

`/admin/reconciliation` tracks provider accounts:

```text
calculated balance = opening balance
                   + completed provider payments
                   − settled provider fees
                   − completed transfers out
                   + completed transfers in
```

Pending fees and non-completed transfers do not change the calculated balance.
Recording a settlement creates a completed `Transfer` from the provider account
to a business source. Reconciliation stores the actual statement balance, the
calculated balance, and the difference.

TEST accounts are simulated and labeled. Reports include only LIVE provider
reconciliations in financial totals.

## Limitations

- No real payment provider or bank integration.
- No automatic bank statement import; reconciliation balances are entered
  manually.
- No settlement status workflow beyond the completed records created by the UI.
- No scheduled report delivery.
- Reports load the selected range in memory; very large ranges may need streaming
  or pagination in production.
- Revenue recognition remains cash-basis and TEST-excluded.

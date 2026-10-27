# OBH database architecture

This document records the database decisions implemented in the Prisma schema
through Step 7. The schema creates durable financial structures; reporting and
profit calculations remain later work.

Prisma: `7.10.1` with the `prisma-client` generator and `@prisma/adapter-pg`.
PostgreSQL is the only supported database.

## Core boundaries

OBH keeps four related but distinct concerns separate:

| Concern | Tables | Meaning |
| --- | --- | --- |
| Payment lifecycle | `Payment`, `PaymentEvent`, `PaymentVerification`, `WebhookDelivery` | What happened to an attempted payment and how it was verified |
| Accounts and cash movement | `FinancialAccount`, `AccountReconciliation`, `Transfer`, `ProviderFee`, `Expense`, `Income`, `CapitalContribution`, `ShareholderPayout` | Money held or moved, derived balances, and reconciliation |
| Accounting results | `Expense`, `Income`, `ProfitPeriod` | Revenue, costs, and frozen profit calculations |
| Ownership | `Shareholder`, `OwnershipRecord`, `ProfitDistribution`, `ShareholderPayout` | Equity history, allocations, and cash payouts |

No table stores a general “current balance” as unquestioned truth. A future
calculated balance is derived from an opening balance plus completed movements.
An actual balance is only the value recorded in `AccountReconciliation`.
Pending payments, transfers, and payouts are excluded until their own status
rules say they are completed.

This is a normalized financial-record model, not a double-entry general ledger.
A ledger can be introduced later if required, but it is not being assumed now.

## Main relationships

```text
ConnectedService 1 ─── * ServiceCredential
ConnectedService 1 ─── * Payment
ConnectedService 1 ─── * PaymentIdempotencyRecord
Payment          1 ─── * PaymentIdempotencyRecord

ExpenseCategory  1 ─── * Expense
ExpenseCategory  1 ─── * RecurringExpense
FinancialAccount 1 ─── * Expense
FinancialAccount 1 ─── * Income
Expense          1 ─── * ExpenseDocument
RecurringExpense 1 ─── * Expense
PaymentProvider  1 ─── * FinancialAccount (kind = PROVIDER)
PaymentProvider  1 ─── * Payment
FinancialAccount 1 ─── * Payment (provider account)
Payment          1 ─── * PaymentEvent
Payment          1 ─── * PaymentVerification
Payment          1 ─── * ProviderFee
Payment          1 ─── * WebhookDelivery

FinancialAccount 1 ─── * Transfer (from / to)
FinancialAccount 1 ─── * AccountReconciliation
FinancialAccount 1 ─── * Expense / Income / CapitalContribution / ShareholderPayout

Shareholder      1 ─── * OwnershipRecord
Shareholder      1 ─── * CapitalContribution
Shareholder      1 ─── * ProfitDistribution
ProfitPeriod     1 ─── * ProfitDistribution
ProfitDistribution 1 ─ * ShareholderPayout
```

`FinancialAccount.kind` distinguishes `PROVIDER` and `BUSINESS` accounts. A
provider is `PaymentProvider`; a connected service is `ConnectedService`. None
of these are interchangeable.

`ConnectedService.allowedReturnUrls` is an exact allowlist and
`defaultReturnUrl` is used when a payment request omits its return URL.
`Payment.returnUrl` preserves the validated destination for the provider flow.
`Payment.requestFingerprint` is a canonical hash used to detect idempotency-key
and external-order conflicts.
`Payment.environment` and `ServiceCredential.environment` separate TEST from
LIVE. The current development adapter can only write TEST payments.
`ServiceCredential` stores a public `keyId`, a one-way secret hash, and its
environment; raw credentials are shown once at issuance and never stored.
`ConnectedService.webhookSecretEncrypted` stores an AES-256-GCM encrypted
per-service webhook signing secret; the raw value is shown once and rotation is
explicit.

## Accounting records

- `ExpenseCategory.requiresDocument` makes the supporting-document rule
  configurable per category.
- `Expense.recurringExpenseId` links a generated occurrence to its approved rule.
  The unique `(recurringExpenseId, spentOn)` pair prevents duplicate occurrences.
- `RecurringExpense` starts as `DRAFT` and can only generate expenses after an
  explicit approval records `approvedAt` and `approvedById`.
- `ExpenseDocument` stores metadata only. File binaries live in private local
  storage in development, never in PostgreSQL.
- `Income` remains separate from `Payment` and `CapitalContribution`.

## Profit periods and distributions

- `ProfitPeriod` is one calendar month with frozen revenue, expenses, fees,
  reserve, tax, net profit, loss carryforward, distributable amount, ownership
  total, and retained residual.
- Only approved/closed periods contribute to distributable totals.
- `ProfitDistribution.percentageSnapshot` freezes period-end ownership.
- `ShareholderPayout` has a unique `profitDistributionId`; Step 9 policy is one
  full payout per shareholder allocation.
- `ProfitPeriod.status = CLOSED` means all positive allocations were paid, or the
  period had no distributable profit.
- Approved periods are immutable snapshots; late entries do not rewrite them.
- TEST payments are excluded from revenue and profit.

## Financial rules encoded as structure

- All monetary fields use PostgreSQL `NUMERIC(24, 2)` through Prisma `Decimal`.
  Application code must use `Prisma.Decimal`, never JavaScript floating point.
- Every monetary row carries an explicit currency and defaults to `IRR`.
  No exchange-rate or automatic conversion fields exist.
- Event instants use `timestamptz(3)`. Accounting dates (`spentOn`, `receivedOn`,
  period boundaries, ownership dates, contribution dates) use PostgreSQL `date`.
- Payment creates no accounting entry automatically. Accounting records and cash
  movements remain explicit and reviewable.
- `ProviderFee` is separate from gross payment amount.
- `ProfitPeriod` totals stay null until a calculation is intentionally recorded.
  `distributableAmount` is separate from `netProfit` because not all profit is
  assumed to be distributable.
- `ProfitDistribution.percentageSnapshot` preserves the ownership percentage
  used for an allocation.
- `CapitalContribution` is separate from `Income` and profit distributions.
- Financial records use restrictive foreign keys and status/void fields. No
  cascading deletes are defined for financial data.

## Idempotency and duplicate prevention

- `Payment` has a unique `(serviceId, externalOrderId)` pair when both are set.
- `Payment` has a unique `(serviceId, idempotencyKey)` pair when both are set.
- `PaymentIdempotencyRecord` is a service-scoped ledger of every consumed API
  idempotency key. It allows multiple keys to map to one replayed payment while
  preventing any consumed key from being reused for a different request.
- `Payment.requestFingerprint` makes reuse of either identifier with different
  financial details an explicit conflict rather than a silent replay.
- `ProviderReference` is indexed for provider reconciliation.
- `ProfitDistribution` has a unique `(profitPeriodId, shareholderId)` pair.
- `WebhookDelivery` has a unique `(paymentId, eventType)` pair.
- Provider account references, transfers, and manually recorded financial
  sources have their own references but no global uniqueness assumption is made
  beyond the fields declared in the schema.

The external-order uniqueness semantics are defined in the v1 API contract:
API creation must resolve idempotent retries, and conflicting reuse of an
external order is rejected. The Step 5 admin test path rejects any reuse of an
external order for the same service.

## Credentials and sensitive data

- `ServiceCredential` stores a public `keyId` and a one-way `secretHash`; it never
  stores a raw API secret.
- Payment provider credentials are intentionally not in the database. They stay
  in server-side environment variables or an approved secret manager.
- Provider account identifiers are expected to be masked/reference values, not
  full card numbers or credentials.
- Webhook signatures and delivery secrets are deferred to Step 6.

## Server-side data access

Only `lib/db/client.ts` constructs Prisma Client. It imports `server-only`, uses
the PostgreSQL driver adapter, and is reused across development hot reloads.
Query and transaction code belongs under `server/`. Shared packages, including
`@obhco/payments`, must not import this database module or generated Prisma code.

## Schema workflow

This project uses `prisma db push` rather than a migration history.

From the repository root:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:push
```

`DATABASE_URL` is configured in `apps/web/.env` for local development.
`prisma generate` does not need a live database, so the public site can still
build before credentials are provided. Because `db push` applies schema changes
directly, take a backup before using it against a database containing real
financial records.

## Rules that are NOT implemented yet

The following require explicit decisions before Step 7/8 business logic:

1. The exact profit distribution rule. Ownership percentage is stored, but it is
   not assumed to be the only rule, nor that all profit is distributed.
2. Revenue recognition policy and the official reporting time zone/date boundary.
3. Whether reports use cash basis, accrual basis, or both, and how that is labeled.
4. Fee ownership, settlement timing, and how provider differences are handled.
5. Refund/reversal workflow and whether reversals are separate records or status
   changes. The schema has room for void statuses but implements no rules.
6. Recurring-expense cadence and approval rules.
7. Whether expenses require approval before payment.
8. How opening balances are established and who may record reconciliations.
9. Validation rules for overlapping ownership periods and rounding of
   percentage-based distributions.
10. Service credential format, hashing algorithm, rotation, and webhook signing.
11. Provider credential storage choice (environment variables vs an approved
    encrypted secret store).
12. Whether a failed external order can be retried with a new payment.

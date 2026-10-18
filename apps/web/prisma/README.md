# OBH database architecture — Step 2 foundation

This document records the database decisions implemented in the initial Prisma
schema. The schema creates durable structures for later modules, but does not
implement calculations, provider integration, or authorization.

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
- `ProviderReference` is indexed for provider reconciliation.
- `ProfitDistribution` has a unique `(profitPeriodId, shareholderId)` pair.
- `WebhookDelivery` has a unique `(paymentId, eventType)` pair.
- Provider account references, transfers, and manually recorded financial
  sources have their own references but no global uniqueness assumption is made
  beyond the fields declared in the schema.

The external-order uniqueness semantics still need confirmation: a failed
payment may or may not be reusable for a retry of the same external order.

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
`@obh/payments`, must not import this database module or generated Prisma code.

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

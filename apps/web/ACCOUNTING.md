# OBH accounting: income, expenses, and documents

Status: Step 7 implements the operating accounting records. Equity and profit
distribution are documented in [`EQUITY.md`](EQUITY.md); reporting and
reconciliation are documented in [`REPORTS.md`](REPORTS.md).

## Record boundaries

- `Income` is additional business income. It is not an incoming `Payment`, a
  gateway settlement, or shareholder `CapitalContribution`.
- `Expense` is an operating cost. It is not a cash transfer or a provider fee.
- `Payment` remains the authoritative record of a customer payment. Recording a
  payment does not automatically create an income or accounting entry.
- Shareholder capital and payouts remain separate from both income and expenses.

## Payment sources

Business-owned bank, cash, and wallet accounts are `FinancialAccount` records
with `kind = BUSINESS`. They are managed at `/admin/accounts`.

- Provider accounts are not valid payment sources for income or expenses.
- Account names, institutions, and masked identifiers are allowed. Full card
  numbers, IBANs, and credentials must never be entered.
- Opening balances are recorded explicitly with a date. No calculated running
  balance is presented in Step 7.
- Deactivating a source prevents new selections but preserves historical records.

## Expenses

Expenses begin as `PENDING`. A manager marks an expense `PAID` by selecting an
active business payment source. That action records the source and paid time; it
does not create a transfer or move money.

- `PAID` is a terminal display state for this step.
- `VOIDED` exists in the schema, but a void/void-reason workflow is not yet
  implemented.
- There is no hard-delete workflow for financial records.
- `PENDING` expenses are excluded from the paid-this-month total.

## Categories and required documents

Categories are managed in the Expenses workspace.

- A category can require at least one supporting document.
- The server enforces this requirement before marking an expense paid.
- Deactivating a category preserves existing expenses but removes it from new
  record selection.
- Categories currently cannot be renamed after creation. Create a replacement
  category when reporting semantics change.

## Reference documents

Only `PDF`, `PNG`, `JPEG`, and `WebP` files up to **10 MB** are accepted. The
server checks the file signature in addition to the declared MIME type.

- Metadata lives in `ExpenseDocument`; binaries are never stored in PostgreSQL.
- When `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
  `CLOUDINARY_API_SECRET` are configured, new reference files are uploaded to
  Cloudinary under `obh/expense-documents` (override with
  `CLOUDINARY_EXPENSE_FOLDER`). Uploads are signed server-side and the secret is
  never exposed to the browser.
- Without Cloudinary credentials, local development stores files under
  `apps/web/storage/expense-documents/` by default. Set `EXPENSE_DOCUMENT_DIR`
  to override this.
- The local storage directory is gitignored and must not be served as a static
  folder.
- Downloads go through `/admin/expenses/documents/[id]`, require an active
  manager session, use `Content-Disposition: attachment`, and disable inline
  rendering and caching. Cloudinary files are proxied through the same route, so
  their storage URL is not exposed to the browser.
- Checksums are recorded for integrity verification.
- Uploads require a same-origin admin request.
- Local storage is not production-ready object storage. Cloudinary is the
  intended production backend; consent/retention policy and antivirus scanning
  are still not implemented.

## Recurring expenses

Recurring expenses are **approval-gated templates**, not automatic charges.

- A new rule starts as `DRAFT`.
- A manager must explicitly approve it. Approval records `approvedAt` and
  `approvedById`, plus an audit entry.
- `ACTIVE` rules can be paused, resumed, or ended.
- Generation is manual and only allowed when the rule is active and
  `nextDueOn <= today`.
- A generated occurrence is a normal `PENDING` expense linked to the rule. It
  must still satisfy the category's document requirement before it can be paid.
- A unique `(recurringExpenseId, spentOn)` constraint prevents duplicate
  occurrences for the same rule/date.
- `nextDueOn` advances by the rule's frequency and interval. If the next date is
  beyond `endOn`, the rule becomes `ENDED`.
- No scheduler, background worker, or automatic payment exists.

"Approved" here means an authorized manager explicitly activated the rule. It
does not imply a second-person approval workflow.

## Date semantics

- Accounting dates (`receivedOn`, `spentOn`, start/end dates) are date-only
  values stored as PostgreSQL `date`.
- The UI parses them as UTC dates so a calendar date does not shift by viewer
  timezone.
- Paid/approved/document timestamps are instants and display in Asia/Tehran.
- Month summary boundaries currently use UTC. The formal reporting timezone is
  still unresolved and must be confirmed before reports are built.

## Views

- `/admin/accounts` — business payment sources.
- `/admin/expenses` — summaries, expenses, recurring rules, categories, documents.
- `/admin/income` — additional income and summaries.

The dashboard remains clearly labeled development data. `/admin/reports` remains
a placeholder until the reporting step.

## Verification

- Unit tests cover recurrence date math, including month-end clamping.
- Browser tests cover account creation, category creation, document-required
  payment enforcement, upload/download, paid state, recurring approval and
  generation, and income recording.
- No real financial value moves, and no production object storage is configured.

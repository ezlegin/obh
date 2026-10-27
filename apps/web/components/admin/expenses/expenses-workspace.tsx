"use client"

import {
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Repeat2,
  Search,
  Trash2,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect } from "@workspace/ui/components/native-select"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import {
  ExpenseStatusBadge,
  RecurringStatusBadge,
} from "@/components/admin/accounting/status-badges"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { CreateCategoryDialog } from "@/components/admin/expenses/create-category-dialog"
import { CreateExpenseDialog } from "@/components/admin/expenses/create-expense-dialog"
import { CreateRecurringDialog } from "@/components/admin/expenses/create-recurring-dialog"
import { ExpenseDetailDialog } from "@/components/admin/expenses/expense-detail-dialog"
import {
  changeRecurringExpenseStatusAction,
  deleteExpenseAction,
  deleteExpenseCategoryAction,
  deleteRecurringExpenseAction,
  generateRecurringExpenseAction,
  toggleExpenseCategoryAction,
} from "@/app/admin/expenses/actions"
import type {
  AdminExpense,
  AdminRecurringExpense,
  ExpenseWorkspace,
} from "@/server/accounting/queries"
import { formatAccountingDate, formatIrrDecimal } from "@/lib/admin/format"

type Tab = "expenses" | "recurring" | "categories"

const frequencyLabels = {
  WEEKLY: "week",
  MONTHLY: "month",
  QUARTERLY: "quarter",
  YEARLY: "year",
} as const

function frequencyLabel(rule: AdminRecurringExpense) {
  return rule.intervalCount === 1
    ? `Every ${frequencyLabels[rule.frequency]}`
    : `Every ${rule.intervalCount} ${frequencyLabels[rule.frequency]}s`
}

function ExpensesWorkspace({ data }: { data: ExpenseWorkspace }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("expenses")
  const [createExpenseOpen, setCreateExpenseOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<AdminExpense | null>(
    null
  )
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
  const [createRecurringOpen, setCreateRecurringOpen] = useState(false)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const activeCategories = data.categories.filter(
    (category) => category.isActive
  )
  const selectedExpense =
    data.expenses.find((expense) => expense.id === selectedExpenseId) ?? null

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase()

    return data.expenses.filter((expense) => {
      if (categoryFilter !== "all" && expense.categoryId !== categoryFilter) {
        return false
      }

      if (statusFilter !== "all" && expense.status !== statusFilter) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        expense.description,
        expense.categoryName,
        expense.accountName,
        expense.serviceName,
        expense.externalReference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [data.expenses, search, categoryFilter, statusFilter])

  const updateExpenseStatus = async (
    rule: AdminRecurringExpense,
    action: "approve" | "pause" | "resume" | "end"
  ) => {
    if (
      (action === "approve" || action === "end") &&
      !window.confirm(
        action === "approve"
          ? `Approve "${rule.description}"? Approved rules can generate pending expenses when due.`
          : `End "${rule.description}"? No further occurrences can be generated.`
      )
    ) {
      return
    }

    setPendingKey(`${action}:${rule.id}`)
    setError(null)

    const result = await changeRecurringExpenseStatusAction({
      recurringExpenseId: rule.id,
      action,
    })

    if (!result.ok) {
      setError(result.error ?? "The recurring expense could not be updated.")
    } else {
      router.refresh()
    }

    setPendingKey(null)
  }

  const generateOccurrence = async (rule: AdminRecurringExpense) => {
    setPendingKey(`generate:${rule.id}`)
    setError(null)

    const result = await generateRecurringExpenseAction({
      recurringExpenseId: rule.id,
    })

    if (!result.ok) {
      setError(result.error ?? "The occurrence could not be generated.")
    } else {
      if (result.expenseId) {
        setSelectedExpenseId(result.expenseId)
      }
      setTab("expenses")
      router.refresh()
    }

    setPendingKey(null)
  }

  const toggleCategory = async (
    categoryId: string,
    isActive: boolean,
    name: string
  ) => {
    if (
      isActive &&
      !window.confirm(
        `Deactivate "${name}"? Existing expenses remain, but it will no longer be selectable for new records.`
      )
    ) {
      return
    }

    setPendingKey(`category:${categoryId}`)
    setError(null)

    const result = await toggleExpenseCategoryAction({
      categoryId,
      isActive: !isActive,
    })

    if (!result.ok) {
      setError(result.error ?? "The category could not be updated.")
    } else {
      router.refresh()
    }

    setPendingKey(null)
  }

  const removeExpense = async (expense: AdminExpense) => {
    if (
      !window.confirm(
        `Remove expense "${expense.description}"? This cannot be undone.`
      )
    ) {
      return
    }

    setPendingKey(`delete-expense:${expense.id}`)
    setError(null)

    const result = await deleteExpenseAction({ expenseId: expense.id })

    if (!result.ok) {
      setError(result.error ?? "The expense could not be removed.")
    } else {
      if (selectedExpenseId === expense.id) {
        setSelectedExpenseId(null)
      }
      router.refresh()
    }

    setPendingKey(null)
  }

  const removeRecurringRule = async (rule: AdminRecurringExpense) => {
    if (
      !window.confirm(
        `Remove recurring rule "${rule.description}"? This cannot be undone.`
      )
    ) {
      return
    }

    setPendingKey(`delete-recurring:${rule.id}`)
    setError(null)

    const result = await deleteRecurringExpenseAction({
      recurringExpenseId: rule.id,
    })

    if (!result.ok) {
      setError(result.error ?? "The recurring rule could not be removed.")
    } else {
      router.refresh()
    }

    setPendingKey(null)
  }

  const removeCategory = async (categoryId: string, name: string) => {
    if (
      !window.confirm(
        `Remove category "${name}"? Any expenses or recurring rules in this category will also be removed.`
      )
    ) {
      return
    }

    setPendingKey(`delete-category:${categoryId}`)
    setError(null)

    const result = await deleteExpenseCategoryAction({ categoryId })

    if (!result.ok) {
      setError(result.error ?? "The category could not be removed.")
    } else {
      router.refresh()
    }

    setPendingKey(null)
  }

  const expenseColumns: DataTableColumn<AdminExpense>[] = [
    {
      id: "expense",
      header: "Expense",
      sortValue: (expense) => expense.description,
      cell: (expense) => (
        <div>
          <p className="text-xs font-medium">{expense.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {expense.categoryName}
            </span>
            {expense.recurringExpenseId ? (
              <Badge variant="outline">Recurring</Badge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "date",
      header: "Date",
      sortValue: (expense) => expense.spentOn,
      cell: (expense) => (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatAccountingDate(expense.spentOn)}
        </span>
      ),
    },
    {
      id: "source",
      header: "Source",
      cell: (expense) => (
        <span className="text-[11px] text-muted-foreground">
          {expense.accountName ?? "Not assigned"}
        </span>
      ),
    },
    {
      id: "service",
      header: "Service",
      cell: (expense) => (
        <span className="text-[11px] text-muted-foreground">
          {expense.serviceName ?? "Corporate"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (expense) => <ExpenseStatusBadge status={expense.status} />,
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (expense) => Number(expense.amount),
      cell: (expense) => (
        <span className="text-xs font-medium tabular-nums">
          {formatIrrDecimal(expense.amount)}
        </span>
      ),
    },
    {
      id: "documents",
      header: "Docs",
      align: "right",
      cell: (expense) => (
        <div className="flex items-center justify-end gap-1.5">
          {expense.documents.length > 0 ? (
            <FileCheck2 aria-hidden="true" className="size-3.5 text-success" />
          ) : expense.categoryRequiresDocument ? (
            <FileCheck2 aria-hidden="true" className="size-3.5 text-warning" />
          ) : (
            <FileCheck2
              aria-hidden="true"
              className="size-3.5 text-muted-foreground/40"
            />
          )}
          <span className="font-mono text-[10px] text-muted-foreground">
            {expense.documents.length}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (expense) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setSelectedExpenseId(expense.id)}
          >
            View
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit ${expense.description}`}
            onClick={() => setEditingExpense(expense)}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${expense.description}`}
            onClick={() => removeExpense(expense)}
            disabled={pendingKey === `delete-expense:${expense.id}`}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            {pendingKey === `delete-expense:${expense.id}` ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingStat
          label="Spent this month"
          value={formatIrrDecimal(data.summary.paidThisMonth)}
          hint="Expenses recorded with an expense date in the current month."
          icon={Wallet}
        />
        <AccountingStat
          label="Total records"
          value={String(data.summary.expenseCount)}
          hint="Recorded operating expenses."
          icon={Receipt}
        />
        <AccountingStat
          label="Supporting documents"
          value={String(data.summary.documentCount)}
          hint="Private files attached to expense records."
          icon={FileCheck2}
        />
        <AccountingStat
          label="Active recurring rules"
          value={String(data.summary.activeRecurring)}
          hint="Active rules that generate paid expenses when due."
          icon={Repeat2}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      {activeCategories.length === 0 ? (
        <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-warning/20 bg-warning/[0.035] p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium">
              Create an expense category first
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Categories and document requirements are required before recording
              expenses or recurring rules.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateCategoryOpen(true)}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Create category
          </Button>
        </div>
      ) : null}

      {data.accounts.length === 0 ? (
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
          No business payment source exists yet. Expenses can be recorded, but
          they cannot be marked paid until a source is added.{" "}
          <Link
            href="/admin/accounts"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Manage payment sources
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-6 flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-end">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["expenses", `Expenses (${data.expenses.length})`],
              ["recurring", `Recurring (${data.recurringExpenses.length})`],
              ["categories", `Categories (${data.categories.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
              className={
                tab === value
                  ? "rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-foreground"
                  : "rounded-full px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {tab === "expenses" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (activeCategories.length === 0) {
                  setError("Create an active expense category first.")
                  setCreateCategoryOpen(true)
                  return
                }
                setCreateExpenseOpen(true)
              }}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Add expense
            </Button>
          ) : null}
          {tab === "recurring" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (activeCategories.length === 0) {
                  setError("Create an active expense category first.")
                  setCreateCategoryOpen(true)
                  return
                }
                setCreateRecurringOpen(true)
              }}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              New recurring rule
            </Button>
          ) : null}
          {tab === "categories" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateCategoryOpen(true)}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              New category
            </Button>
          ) : null}
        </div>
      </div>

      {tab === "expenses" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground/60"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search expenses"
                aria-label="Search expenses"
                className="h-10 pl-9 text-xs"
              />
            </div>
            <NativeSelect
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
              className="h-10 text-xs lg:w-48"
            >
              <option value="all">All categories</option>
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="h-10 text-xs lg:w-40"
            >
              <option value="all">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="VOIDED">Voided</option>
            </NativeSelect>
          </div>

          <DataTable
            rows={filteredExpenses}
            columns={expenseColumns}
            getRowId={(expense) => expense.id}
            caption="Expense records"
            defaultSort={{ columnId: "date", direction: "desc" }}
            minWidthClassName="min-w-[56rem]"
            emptyState={
              <AdminEmptyState
                icon={Receipt}
                title={
                  data.expenses.length === 0
                    ? "No expenses recorded yet"
                    : "No expenses match these filters"
                }
                description={
                  data.expenses.length === 0
                    ? "Record the first operating cost. Attach supporting documents and mark it paid when appropriate."
                    : "Clear or change the search and filters to see other expenses."
                }
                action={
                  data.expenses.length === 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setCreateExpenseOpen(true)}
                      disabled={activeCategories.length === 0}
                    >
                      <Plus aria-hidden="true" className="size-3.5" />
                      Record first expense
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("")
                        setCategoryFilter("all")
                        setStatusFilter("all")
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            }
          />
        </div>
      ) : null}

      {tab === "recurring" ? (
        <div className="mt-4">
          <div className="rounded-2xl border border-info/20 bg-info/[0.035] p-4">
            <p className="text-xs font-medium">Recurring operating costs</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Recurring rules are active immediately upon creation. Generating a
              due occurrence records a paid expense and deducts it from the
              business balance.
            </p>
          </div>

          {data.recurringExpenses.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-card/40">
              <AdminEmptyState
                icon={CalendarClock}
                title="No recurring rules yet"
                description="Create a rule for a repeating operating cost."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateRecurringOpen(true)}
                    disabled={activeCategories.length === 0}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Create recurring rule
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.recurringExpenses.map((rule) => (
                <article
                  key={rule.id}
                  className="rounded-2xl border border-border bg-card/40 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-medium">
                          {rule.description}
                        </h2>
                        <RecurringStatusBadge status={rule.status} />
                        {rule.status === "ACTIVE" && rule.isDue ? (
                          <Badge variant="danger">Due</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {rule.categoryName} · {frequencyLabel(rule)} ·{" "}
                        {rule.accountName ?? "No payment source"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        Next due {formatAccountingDate(rule.nextDueOn)}
                        {rule.endOn
                          ? ` · ends ${formatAccountingDate(rule.endOn)}`
                          : ""}
                        {` · ${rule.expenseCount} generated`}
                      </p>
                      {rule.notes ? (
                        <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted-foreground">
                          {rule.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <p className="text-base font-medium tabular-nums">
                        {formatIrrDecimal(rule.amount)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {rule.status === "DRAFT" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => updateExpenseStatus(rule, "approve")}
                            disabled={pendingKey === `approve:${rule.id}`}
                          >
                            {pendingKey === `approve:${rule.id}` ? (
                              <Loader2
                                aria-hidden="true"
                                className="size-3.5 animate-spin"
                              />
                            ) : (
                              <CheckCircle2
                                aria-hidden="true"
                                className="size-3.5"
                              />
                            )}
                            Activate rule
                          </Button>
                        ) : null}

                        {rule.status === "ACTIVE" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => generateOccurrence(rule)}
                              disabled={
                                !rule.isDue ||
                                pendingKey === `generate:${rule.id}`
                              }
                              title={
                                rule.isDue
                                  ? "Generate the due expense"
                                  : `Not due until ${formatAccountingDate(rule.nextDueOn)}`
                              }
                            >
                              {pendingKey === `generate:${rule.id}` ? (
                                <Loader2
                                  aria-hidden="true"
                                  className="size-3.5 animate-spin"
                                />
                              ) : (
                                <Plus aria-hidden="true" className="size-3.5" />
                              )}
                              Generate due expense
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateExpenseStatus(rule, "pause")}
                              disabled={pendingKey === `pause:${rule.id}`}
                            >
                              Pause
                            </Button>
                          </>
                        ) : null}

                        {rule.status === "PAUSED" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateExpenseStatus(rule, "resume")}
                            disabled={pendingKey === `resume:${rule.id}`}
                          >
                            Resume
                          </Button>
                        ) : null}

                        {rule.status === "ACTIVE" ||
                        rule.status === "PAUSED" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateExpenseStatus(rule, "end")}
                            disabled={pendingKey === `end:${rule.id}`}
                          >
                            End
                          </Button>
                        ) : null}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRecurringRule(rule)}
                          disabled={
                            pendingKey === `delete-recurring:${rule.id}`
                          }
                          className="text-danger hover:bg-danger/10 hover:text-danger"
                        >
                          {pendingKey === `delete-recurring:${rule.id}` ? (
                            <Loader2
                              aria-hidden="true"
                              className="size-3.5 animate-spin"
                            />
                          ) : (
                            <Trash2 aria-hidden="true" className="size-3.5" />
                          )}
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "categories" ? (
        <div className="mt-4">
          {data.categories.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/40">
              <AdminEmptyState
                icon={Receipt}
                title="No expense categories yet"
                description="Create categories for reporting and to define which expenses require supporting documents."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateCategoryOpen(true)}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Create category
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.categories.map((category) => (
                <article
                  key={category.id}
                  className="rounded-2xl border border-border bg-card/40 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-medium">{category.name}</h2>
                        <Badge
                          variant={category.isActive ? "success" : "muted"}
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {category.requiresDocument ? (
                          <Badge variant="warning">Document required</Badge>
                        ) : null}
                      </div>
                      {category.description ? (
                        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                          {category.description}
                        </p>
                      ) : null}
                      <p className="mt-2 font-mono text-[9px] text-muted-foreground/60">
                        {category.expenseCount}{" "}
                        {category.expenseCount === 1 ? "expense" : "expenses"} ·{" "}
                        {category.recurringCount}{" "}
                        {category.recurringCount === 1
                          ? "recurring rule"
                          : "recurring rules"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          toggleCategory(
                            category.id,
                            category.isActive,
                            category.name
                          )
                        }
                        disabled={pendingKey === `category:${category.id}`}
                      >
                        {category.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${category.name}`}
                        onClick={() =>
                          removeCategory(category.id, category.name)
                        }
                        disabled={
                          pendingKey === `delete-category:${category.id}`
                        }
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                      >
                        {pendingKey === `delete-category:${category.id}` ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-3.5 animate-spin"
                          />
                        ) : (
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <CreateExpenseDialog
        open={createExpenseOpen || Boolean(editingExpense)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateExpenseOpen(false)
            setEditingExpense(null)
          }
        }}
        categories={activeCategories}
        accounts={data.accounts}
        services={data.services}
        expense={editingExpense}
        onCreated={(expenseId) => {
          setCreateExpenseOpen(false)
          setEditingExpense(null)
          setSelectedExpenseId(expenseId)
          router.refresh()
        }}
      />
      <CreateCategoryDialog
        open={createCategoryOpen}
        onOpenChange={setCreateCategoryOpen}
        onCreated={() => router.refresh()}
      />
      <CreateRecurringDialog
        open={createRecurringOpen}
        onOpenChange={setCreateRecurringOpen}
        categories={activeCategories}
        accounts={data.accounts}
        services={data.services}
        onCreated={() => router.refresh()}
      />
      <ExpenseDetailDialog
        expense={selectedExpense}
        accounts={data.accounts}
        onClose={() => setSelectedExpenseId(null)}
      />
    </>
  )
}

export { ExpensesWorkspace }

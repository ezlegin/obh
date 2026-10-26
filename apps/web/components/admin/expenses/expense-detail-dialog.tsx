"use client"

import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { ExpenseStatusBadge } from "@/components/admin/accounting/status-badges"
import {
  deleteExpenseDocumentAction,
  markExpensePaidAction,
} from "@/app/admin/expenses/actions"
import type { AdminExpense } from "@/server/accounting/queries"
import {
  formatAccountingDate,
  formatDevelopmentDateTime,
  formatFileSize,
  formatIrrDecimal,
} from "@/lib/admin/format"

type AccountOption = { id: string; name: string }

function ExpenseDetailDialog({
  expense,
  accounts,
  onClose,
}: {
  expense: AdminExpense | null
  accounts: AccountOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [accountId, setAccountId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  useEffect(() => {
    if (!expense) {
      return
    }

    setAccountId(expense.accountId ?? accounts[0]?.id ?? "")
    setFile(null)
    setError(null)
    setPendingAction(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [expense?.id, expense?.accountId, accounts])

  if (!expense) {
    return null
  }

  const documentMissing =
    expense.categoryRequiresDocument && expense.documents.length === 0

  const upload = async () => {
    if (!file) {
      setError("Select a document first.")
      return
    }

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.set("expenseId", expense.id)
    formData.set("file", file)

    try {
      const response = await fetch("/admin/expenses/documents", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as {
        ok?: boolean
        error?: string
      }

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "The document could not be uploaded.")
        return
      }

      setFile(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      router.refresh()
    } catch {
      setError("The document could not be uploaded.")
    } finally {
      setIsUploading(false)
    }
  }

  const removeDocument = async (documentId: string, fileName: string) => {
    if (!window.confirm(`Delete ${fileName}? This cannot be undone.`)) {
      return
    }

    setPendingAction(`document:${documentId}`)
    setError(null)

    const result = await deleteExpenseDocumentAction({ documentId })

    if (!result.ok) {
      setError(result.error ?? "The document could not be deleted.")
    } else {
      router.refresh()
    }

    setPendingAction(null)
  }

  const markPaid = async () => {
    if (!accountId) {
      setError("Select a business payment source.")
      return
    }

    setPendingAction("paid")
    setError(null)

    const result = await markExpensePaidAction({
      expenseId: expense.id,
      accountId,
    })

    if (!result.ok) {
      setError(result.error ?? "The expense could not be marked paid.")
    } else {
      router.refresh()
    }

    setPendingAction(null)
  }

  return (
    <AdminDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={expense.description}
      description={`${expense.categoryName} · ${formatAccountingDate(expense.spentOn)}`}
      className="max-w-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ExpenseStatusBadge status={expense.status} />
          {expense.recurringExpenseId ? (
            <Badge variant="outline">Recurring occurrence</Badge>
          ) : null}
          {expense.categoryRequiresDocument ? (
            <Badge variant="warning">Document required</Badge>
          ) : null}
        </div>
        <p className="text-lg font-medium tabular-nums">
          {formatIrrDecimal(expense.amount)}
        </p>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-border bg-white/[0.02] p-4 text-xs sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Payment source</p>
          <p className="mt-1">{expense.accountName ?? "Not assigned"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Paid at</p>
          <p className="mt-1">
            {expense.paidAt
              ? formatDevelopmentDateTime(expense.paidAt)
              : "Not paid"}
          </p>
        </div>
        {expense.externalReference ? (
          <div>
            <p className="text-muted-foreground">External reference</p>
            <p className="mt-1 font-mono text-[10px]">
              {expense.externalReference}
            </p>
          </div>
        ) : null}
        {expense.notes ? (
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap">{expense.notes}</p>
          </div>
        ) : null}
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium">Reference documents</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              PDF, PNG, JPEG, or WebP · maximum 10 MB · manager-only access
            </p>
          </div>
          <Badge variant="outline">{expense.documents.length} attached</Badge>
        </div>

        {documentMissing ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/[0.045] p-3 text-[11px] leading-5 text-muted-foreground">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0 text-warning"
            />
            This category requires a reference document before the expense can
            be marked paid.
          </div>
        ) : null}

        {expense.documents.length > 0 ? (
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {expense.documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-white/[0.03]">
                    <FileText
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs">{document.fileName}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {formatFileSize(document.byteSize)} ·{" "}
                      {formatDevelopmentDateTime(document.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/admin/expenses/documents/${document.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "xs" })
                    )}
                  >
                    <Download aria-hidden="true" className="size-3" />
                    Download
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${document.fileName}`}
                    onClick={() =>
                      removeDocument(document.id, document.fileName)
                    }
                    disabled={pendingAction === `document:${document.id}`}
                  >
                    {pendingAction === `document:${document.id}` ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-3 animate-spin"
                      />
                    ) : (
                      <Trash2 aria-hidden="true" className="size-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-5 text-center text-[11px] text-muted-foreground">
            No reference documents attached.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            aria-label="Reference document"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block min-w-0 flex-1 cursor-pointer rounded-full border border-border bg-white/[0.025] text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-white/[0.06] file:px-3 file:py-2 file:text-xs file:text-foreground"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={upload}
            disabled={!file || isUploading}
          >
            {isUploading ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Upload aria-hidden="true" className="size-3.5" />
            )}
            Upload
          </Button>
        </div>
      </section>

      {expense.status === "PENDING" ? (
        <section className="mt-6 border-t border-border pt-5">
          <p className="text-xs font-medium">Mark this expense paid</p>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            This records the payment source and paid time. It does not create a
            separate cash transfer.
          </p>

          {accounts.length === 0 ? (
            <p className="mt-3 rounded-xl border border-warning/20 bg-warning/[0.045] p-3 text-[11px] text-muted-foreground">
              Add a business payment source first.{" "}
              <Link
                href="/admin/accounts"
                className="underline underline-offset-4"
              >
                Manage payment sources
              </Link>
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="paid-account">Payment source</Label>
                <NativeSelect
                  id="paid-account"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button
                type="button"
                onClick={markPaid}
                disabled={
                  pendingAction === "paid" || !accountId || documentMissing
                }
              >
                {pendingAction === "paid" ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="size-4" />
                )}
                Mark paid
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}
    </AdminDialog>
  )
}

export { ExpenseDetailDialog }

"use client"

import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { endOwnershipRecordAction } from "@/app/admin/shareholders/actions"
import type { AdminOwnershipRecord } from "@/server/equity/queries"
import { todayInputValue } from "@/lib/admin/format"

function EndOwnershipDialog({
  record,
  onOpenChange,
  onEnded,
}: {
  record: AdminOwnershipRecord | null
  onOpenChange: (open: boolean) => void
  onEnded: () => void
}) {
  const [effectiveTo, setEffectiveTo] = useState(todayInputValue())
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (record) {
      setEffectiveTo(todayInputValue())
      setError(null)
    }
  }, [record])

  if (!record) {
    return null
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await endOwnershipRecordAction({
      ownershipRecordId: record.id,
      effectiveTo,
    })

    if (!result.ok) {
      setError(result.error ?? "The ownership record could not be ended.")
      setIsPending(false)
      return
    }

    setIsPending(false)
    onOpenChange(false)
    onEnded()
  }

  return (
    <AdminDialog
      open
      onOpenChange={onOpenChange}
      title={`End ownership · ${record.shareholderName}`}
      description={`This open-ended ${record.percentage}% record started on ${record.effectiveFrom}. Setting an end date cannot exceed 100% ownership checks at a future profit period end.`}
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="end-ownership-date">Effective to</Label>
          <Input
            id="end-ownership-date"
            type="date"
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            The record remains effective through this date.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-xs leading-5 text-danger"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Ending…
              </>
            ) : (
              "End ownership record"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { EndOwnershipDialog }

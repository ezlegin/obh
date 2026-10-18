"use client"

import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { recordShareholderPayoutAction } from "@/app/admin/distributions/actions"
import type { AdminProfitDistribution } from "@/server/equity/queries"
import { formatIrrDecimal } from "@/lib/admin/format"

function PayoutDialog({
  distribution,
  accounts,
  onOpenChange,
  onPaid,
}: {
  distribution: AdminProfitDistribution | null
  accounts: Array<{ id: string; name: string }>
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}) {
  const [accountId, setAccountId] = useState("")
  const [externalReference, setExternalReference] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (distribution) {
      setAccountId(accounts[0]?.id ?? "")
      setExternalReference("")
      setNote("")
      setError(null)
    }
  }, [distribution, accounts])

  if (!distribution) {
    return null
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await recordShareholderPayoutAction({
      profitDistributionId: distribution.id,
      accountId,
      externalReference,
      note,
    })

    if (!result.ok) {
      setError(result.error ?? "The payout could not be recorded.")
      setIsPending(false)
      return
    }

    setIsPending(false)
    onOpenChange(false)
    onPaid()
  }

  return (
    <AdminDialog
      open
      onOpenChange={onOpenChange}
      title={`Record payout · ${distribution.shareholderName}`}
      description="This records one full payout for the shareholder allocation. Partial payouts are not enabled."
    >
      <div className="rounded-xl border border-border bg-white/[0.02] p-4">
        <p className="text-[10px] text-muted-foreground">Full allocation</p>
        <p className="mt-1 text-2xl font-medium tabular-nums">
          {formatIrrDecimal(distribution.amount)}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {distribution.percentage}% ownership snapshot
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="payout-account">Payment source</Label>
          <NativeSelect
            id="payout-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={accounts.length === 0}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </NativeSelect>
          {accounts.length === 0 ? (
            <p className="text-[10px] text-warning">
              Add an active business payment source first.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="payout-reference">External reference</Label>
          <Input
            id="payout-reference"
            placeholder="Transfer or settlement reference"
            value={externalReference}
            onChange={(event) => setExternalReference(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payout-note">Note</Label>
          <Textarea
            id="payout-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
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
          <Button type="submit" disabled={isPending || accounts.length === 0}>
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Recording…
              </>
            ) : (
              "Record full payout"
            )}
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

export { PayoutDialog }

"use client"

import {
  CalendarClock,
  Landmark,
  Loader2,
  Percent,
  PiggyBank,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import { AdminDialog } from "@/components/admin/admin-dialog"
import {
  deleteVatReturnAction,
  fileVatReturnAction,
  markVatReturnPaidAction,
  saveVatProfileAction,
  type VatActionResult,
} from "@/app/admin/vat/actions"
import { formatIrrDecimal } from "@/lib/admin/format"
import type {
  VatQuarterRow,
  VatQuarterStatus,
  VatWorkspace as VatWorkspaceData,
} from "@/server/vat/queries"

const STAGE_LABELS: Record<number, string> = {
  1: "Stage 1 · importers, exporters, large sellers (1387)",
  2: "Stage 2 · Article 96(a) activities (1388)",
  3: "Stage 3 · sales ≥ 3bn R in 1387/88 (1389)",
  4: "Stage 4 · Article 96(b) activities (1389)",
  5: "Stage 5 · legal entities with sales ≥ 1bn R (1390)",
  6: "Stage 6 · restaurants and food chains (1394)",
  7: "Stage 7 · all legal entities, any sales (1395)",
  8: "Stage 8 · fuel stations (1399)",
  9: "Stage 9 · kitchens, catering, cafés (1402)",
  10: "Stage 10 · listed retail and services (1402)",
}

function StatusBadge({ status }: { status: VatQuarterStatus }) {
  switch (status) {
    case "open":
      return <Badge variant="outline">In progress</Badge>
    case "due":
      return <Badge variant="info">Ready to file</Badge>
    case "overdue":
      return <Badge variant="danger">Overdue</Badge>
    case "filed":
      return <Badge variant="warning">Filed · unpaid</Badge>
    case "paid":
      return <Badge variant="success">Paid</Badge>
  }
}

function ErrorNote({ message }: { message: string | null }) {
  return message ? (
    <div
      role="alert"
      className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-xs leading-5 text-danger"
    >
      {message}
    </div>
  ) : null
}

function useVatAction() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const run = (action: () => Promise<VatActionResult>, onDone?: () => void) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? "The operation could not be completed.")
        return
      }
      onDone?.()
      router.refresh()
    })
  }

  return { error, setError, isPending, run }
}

function ProfileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: VatWorkspaceData["profile"]
}) {
  const { error, isPending, run } = useVatAction()
  const [stage, setStage] = useState(String(profile?.stage ?? 7))
  const [effectiveFrom, setEffectiveFrom] = useState(
    profile?.effectiveFrom ?? ""
  )
  const [economicCode, setEconomicCode] = useState(profile?.economicCode ?? "")
  const [notes, setNotes] = useState(profile?.notes ?? "")

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title={profile ? "Edit VAT registration" : "Set up VAT registration"}
      description="The stage you chose on the tax portal (تعیین مشمولیت) and the date VAT applies from (تاریخ مشمولیت). Changes are recorded in the audit log."
      className="max-w-xl"
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          run(
            () =>
              saveVatProfileAction({
                stage: Number(stage),
                effectiveFrom,
                economicCode,
                notes,
              }),
            () => onOpenChange(false)
          )
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="vat-stage">Registration stage</Label>
          <NativeSelect
            id="vat-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
          >
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <p className="text-[10px] leading-4 text-muted-foreground/60">
            A company registered after Mehr 1395 is stage 7.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vat-effective">VAT applies from</Label>
            <Input
              id="vat-effective"
              type="date"
              required
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
            <p className="text-[10px] leading-4 text-muted-foreground/60">
              Usually the company&apos;s registration or start-of-activity date.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vat-economic-code">Economic code (optional)</Label>
            <Input
              id="vat-economic-code"
              value={economicCode}
              onChange={(event) => setEconomicCode(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vat-notes">Notes</Label>
          <Textarea
            id="vat-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <ErrorNote message={error} />

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !effectiveFrom}>
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      </form>
    </AdminDialog>
  )
}

function FileReturnDialog({
  quarter,
  onOpenChange,
}: {
  quarter: VatQuarterRow | null
  onOpenChange: (open: boolean) => void
}) {
  const { error, isPending, run } = useVatAction()
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")

  return (
    <AdminDialog
      open={quarter !== null}
      onOpenChange={onOpenChange}
      title={quarter ? `Record filing · ${quarter.label}` : "Record filing"}
      description="Record that this quarter's return was submitted on the tax portal. The figures below are frozen on the return, so later edits to income or expenses will not change them."
      className="max-w-xl"
    >
      {quarter ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            run(
              () =>
                fileVatReturnAction({
                  year: quarter.year,
                  quarter: quarter.quarter,
                  reference,
                  notes,
                }),
              () => {
                setReference("")
                setNotes("")
                onOpenChange(false)
              }
            )
          }}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border p-4 text-xs">
            <dt className="text-muted-foreground">Sales (net of VAT)</dt>
            <dd className="text-right tabular-nums">
              {formatIrrDecimal(quarter.taxableSales)}
            </dd>
            <dt className="text-muted-foreground">VAT collected</dt>
            <dd className="text-right tabular-nums">
              {formatIrrDecimal(quarter.outputVat)}
            </dd>
            <dt className="text-muted-foreground">Purchases (net of VAT)</dt>
            <dd className="text-right tabular-nums">
              {formatIrrDecimal(quarter.purchases)}
            </dd>
            <dt className="text-muted-foreground">Creditable VAT paid</dt>
            <dd className="text-right tabular-nums">
              {formatIrrDecimal(quarter.inputVat)}
            </dd>
            <dt className="font-medium">To pay</dt>
            <dd className="text-right font-medium tabular-nums">
              {formatIrrDecimal(quarter.payable)}
            </dd>
          </dl>

          <div className="space-y-2">
            <Label htmlFor="vat-return-reference">
              Tracking code (optional)
            </Label>
            <Input
              id="vat-return-reference"
              placeholder="کد رهگیری اظهارنامه"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vat-return-notes">Notes</Label>
            <Textarea
              id="vat-return-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <ErrorNote message={error} />

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
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              Record filing
            </Button>
          </div>
        </form>
      ) : null}
    </AdminDialog>
  )
}

function QuarterActions({
  quarter,
  onFile,
}: {
  quarter: VatQuarterRow
  onFile: () => void
}) {
  const { error, isPending, run } = useVatAction()

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {quarter.status === "due" || quarter.status === "overdue" ? (
          <Button type="button" size="sm" onClick={onFile}>
            Record filing
          </Button>
        ) : null}
        {quarter.status === "filed" && quarter.returnId ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(() => markVatReturnPaidAction({ returnId: quarter.returnId }))
            }
          >
            Mark paid
          </Button>
        ) : null}
        {quarter.returnId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Remove the recorded return for ${quarter.label}? Its figures will be recalculated from current records.`
                )
              ) {
                run(() => deleteVatReturnAction({ returnId: quarter.returnId }))
              }
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-[10px] text-danger">{error}</p> : null}
    </div>
  )
}

function VatWorkspace({ data }: { data: VatWorkspaceData }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [filing, setFiling] = useState<VatQuarterRow | null>(null)
  const current = data.quarters.find((quarter) => quarter.status === "open")
  const latest = data.quarters[0]

  return (
    <>
      {data.profile ? (
        <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-card/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-xs">
            <p className="font-medium">
              {STAGE_LABELS[data.profile.stage] ??
                `Stage ${data.profile.stage}`}
            </p>
            <p className="text-muted-foreground">
              VAT applies from {data.profile.effectiveFromPersian} (
              {data.profile.effectiveFrom})
              {data.profile.economicCode
                ? ` · economic code ${data.profile.economicCode}`
                : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setProfileOpen(true)}
          >
            Edit registration
          </Button>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-warning/30 bg-warning/5 p-6">
          <h2 className="text-sm font-medium">VAT is not set up yet</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Until a registration date is saved, every payment counts fully as
            revenue and no returns are tracked. Enter the stage and date you
            chose on the tax portal.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => setProfileOpen(true)}
          >
            Set up VAT
          </Button>
        </section>
      )}

      {data.profile ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AccountingStat
              label="Next deadline"
              value={data.nextDeadline?.dueOnPersian ?? "—"}
              hint={
                data.nextDeadline
                  ? data.nextDeadline.overdue
                    ? `${data.nextDeadline.label} is overdue by ${-data.nextDeadline.daysLeft} days.`
                    : `${data.nextDeadline.label} · ${data.nextDeadline.daysLeft} days left.`
                  : "No returns are pending."
              }
              icon={CalendarClock}
            />
            <AccountingStat
              label="This quarter so far"
              value={current ? formatIrrDecimal(current.payable) : "—"}
              hint={
                current
                  ? `Estimated VAT to pay for ${current.label}: ${formatIrrDecimal(current.outputVat)} collected − ${formatIrrDecimal(current.inputVat)} creditable.`
                  : "The registration date is in the future."
              }
              icon={Landmark}
            />
            <AccountingStat
              label="Credit carried forward"
              value={
                latest
                  ? formatIrrDecimal(
                      String(
                        Math.max(
                          0,
                          Number(latest.creditBroughtForward) -
                            Number(latest.netVat)
                        )
                      )
                    )
                  : "—"
              }
              hint="Creditable VAT above VAT collected, used against later quarters."
              icon={PiggyBank}
            />
            <AccountingStat
              label="Current rate"
              value={`${data.currentRatePercent}%`}
              hint="General rate for this Solar Hijri year (tax + municipal levy), set by the budget law."
              icon={Percent}
            />
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/40">
            <div className="border-b border-border p-4">
              <h2 className="text-sm font-medium">Quarterly returns</h2>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                File every quarter, even with no sales. Figures are live
                estimates until a filing is recorded.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="text-left text-[10px] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 font-normal">Quarter</th>
                    <th className="px-4 py-2.5 text-right font-normal">
                      VAT collected
                    </th>
                    <th className="px-4 py-2.5 text-right font-normal">
                      Creditable VAT
                    </th>
                    <th className="px-4 py-2.5 text-right font-normal">
                      To pay
                    </th>
                    <th className="px-4 py-2.5 font-normal">Due</th>
                    <th className="px-4 py-2.5 font-normal">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.quarters.map((quarter) => (
                    <tr key={`${quarter.year}-${quarter.quarter}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{quarter.label}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {quarter.periodPersian} · {quarter.ratePercent}%
                          {quarter.reference ? ` · ${quarter.reference}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatIrrDecimal(quarter.outputVat)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatIrrDecimal(quarter.inputVat)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatIrrDecimal(quarter.payable)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {quarter.dueOnPersian}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={quarter.status} />
                      </td>
                      <td className="px-4 py-3">
                        <QuarterActions
                          quarter={quarter}
                          onFile={() => setFiling(quarter)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section className="mt-6 rounded-2xl border border-border p-5 text-[11px] leading-5 text-muted-foreground">
        <h2 className="text-xs font-medium text-foreground">
          How VAT is counted
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Completed LIVE gateway payments from the registration date are
            treated as VAT-inclusive, so services must charge price + VAT.
          </li>
          <li>
            On manual income, enter the VAT you charged; on expenses, enter the
            VAT printed on the supplier&apos;s official tax invoice. Both are
            kept out of revenue, costs, and profit distributions.
          </li>
          <li>
            Do not record the VAT you pay the tax authority as an expense: it is
            the collected VAT being handed over, not a cost.
          </li>
        </ul>
      </section>

      <ProfileDialog
        key={profileOpen ? "open" : "closed"}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={data.profile}
      />
      <FileReturnDialog
        quarter={filing}
        onOpenChange={(open) => {
          if (!open) {
            setFiling(null)
          }
        }}
      />
    </>
  )
}

export { VatWorkspace }

"use client"

import {
  CalendarOff,
  History,
  Pencil,
  Percent,
  Plus,
  Power,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AccountingStat } from "@/components/admin/accounting/accounting-stat"
import { AdminEmptyState } from "@/components/admin/empty-state"
import { EndOwnershipDialog } from "@/components/admin/shareholders/end-ownership-dialog"
import { OwnershipDialog } from "@/components/admin/shareholders/ownership-dialog"
import { ShareholderDialog } from "@/components/admin/shareholders/shareholder-dialog"
import { toggleShareholderAction } from "@/app/admin/shareholders/actions"
import type {
  AdminOwnershipRecord,
  AdminShareholder,
  ShareholderWorkspace,
} from "@/server/equity/queries"
import { formatAccountingDate } from "@/lib/admin/format"

function ShareholdersWorkspace({ data }: { data: ShareholderWorkspace }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AdminShareholder | null>(null)
  const [ownershipTarget, setOwnershipTarget] =
    useState<AdminShareholder | null>(null)
  const [endingRecord, setEndingRecord] = useState<AdminOwnershipRecord | null>(
    null
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentTotalIsValid = data.currentTotal === "100.0000"
  const refresh = () => router.refresh()

  const toggleShareholder = async (shareholder: AdminShareholder) => {
    if (
      shareholder.isActive &&
      !window.confirm(
        `Deactivate ${shareholder.name}? Their historical ownership and distributions remain intact.`
      )
    ) {
      return
    }

    setPendingId(`shareholder:${shareholder.id}`)
    setError(null)

    const result = await toggleShareholderAction({
      shareholderId: shareholder.id,
      isActive: !shareholder.isActive,
    })

    if (!result.ok) {
      setError(result.error ?? "The shareholder status could not be changed.")
    } else {
      refresh()
    }

    setPendingId(null)
  }

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AccountingStat
          label="Active shareholders"
          value={String(data.activeCount)}
          hint="Profiles marked active. Ownership is evaluated historically."
          icon={Users}
        />
        <AccountingStat
          label="Current ownership"
          value={`${data.currentTotal}%`}
          hint={`Total ownership effective on ${formatAccountingDate(data.currentAsOf)}.`}
          icon={Percent}
        />
        <AccountingStat
          label="Ownership records"
          value={String(data.ownershipRecordCount)}
          hint="Historical effective-date records, including ended periods."
          icon={History}
        />
        <AccountingStat
          label="Distribution readiness"
          value={currentTotalIsValid ? "Ready" : "Incomplete"}
          hint="A profit period requires exactly 100.0000% ownership at its end date."
          icon={ShieldCheck}
        />
      </div>

      {!currentTotalIsValid ? (
        <div className="mt-4 rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
          <p className="text-xs font-medium">
            Current ownership totals {data.currentTotal}%
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            Profit calculations require exactly 100.0000% ownership effective on
            the period end date. Add or end ownership records before calculating
            a positive distribution.
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Shareholder register
          </p>
          <p className="mt-2 text-sm font-medium">
            {data.shareholders.length}{" "}
            {data.shareholders.length === 1 ? "profile" : "profiles"}
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <UserPlus aria-hidden="true" className="size-4" />
          Add shareholder
        </Button>
      </div>

      {data.shareholders.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card/40">
          <AdminEmptyState
            icon={Users}
            title="No shareholders yet"
            description="Add shareholder profiles and their historical ownership records. No distribution can be calculated until period-end ownership totals exactly 100.0000%."
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <UserPlus aria-hidden="true" className="size-3.5" />
                Add first shareholder
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {data.shareholders.map((shareholder) => (
            <article
              key={shareholder.id}
              className="overflow-hidden rounded-2xl border border-border bg-card/40"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium tracking-[-0.02em]">
                      {shareholder.name}
                    </h2>
                    <Badge variant={shareholder.isActive ? "success" : "muted"}>
                      {shareholder.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">
                      {shareholder.currentPercentage}% current
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {shareholder.email ?? "No email"}
                    {shareholder.phone ? ` · ${shareholder.phone}` : ""}
                  </p>
                  {shareholder.notes ? (
                    <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted-foreground">
                      {shareholder.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOwnershipTarget(shareholder)}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Add ownership
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCreateOpen(false)
                      setEditing(shareholder)
                    }}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleShareholder(shareholder)}
                    disabled={pendingId === `shareholder:${shareholder.id}`}
                  >
                    <Power aria-hidden="true" className="size-3.5" />
                    {shareholder.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>

              <div className="p-5">
                <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground/60 uppercase">
                  Ownership history · {shareholder.records.length}
                </p>

                {shareholder.records.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-5 text-center text-[11px] text-muted-foreground">
                    No ownership records for this shareholder.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                    {shareholder.records.map((record) => {
                      const current =
                        record.effectiveFrom <= data.currentAsOf &&
                        (!record.effectiveTo ||
                          record.effectiveTo >= data.currentAsOf)
                      const upcoming = record.effectiveFrom > data.currentAsOf

                      return (
                        <div
                          key={record.id}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium tabular-nums">
                                {record.percentage}%
                              </p>
                              <Badge
                                variant={
                                  current
                                    ? "success"
                                    : upcoming
                                      ? "info"
                                      : "muted"
                                }
                              >
                                {current
                                  ? "Current"
                                  : upcoming
                                    ? "Upcoming"
                                    : "Ended"}
                              </Badge>
                            </div>
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                              {formatAccountingDate(record.effectiveFrom)} —{" "}
                              {record.effectiveTo
                                ? formatAccountingDate(record.effectiveTo)
                                : "open-ended"}
                            </p>
                            {record.note ? (
                              <p className="mt-1 text-[10px] text-muted-foreground/70">
                                {record.note}
                              </p>
                            ) : null}
                          </div>
                          {!record.effectiveTo ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => setEndingRecord(record)}
                            >
                              <CalendarOff
                                aria-hidden="true"
                                className="size-3"
                              />
                              End record
                            </Button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <ShareholderDialog
        shareholder={editing}
        open={createOpen || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        onSaved={() => {
          setCreateOpen(false)
          setEditing(null)
          refresh()
        }}
      />
      <OwnershipDialog
        shareholder={ownershipTarget}
        open={Boolean(ownershipTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setOwnershipTarget(null)
          }
        }}
        onCreated={refresh}
      />
      <EndOwnershipDialog
        record={endingRecord}
        onOpenChange={(open) => {
          if (!open) {
            setEndingRecord(null)
          }
        }}
        onEnded={refresh}
      />
    </>
  )
}

export { ShareholdersWorkspace }

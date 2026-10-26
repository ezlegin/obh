"use client"

import {
  Activity,
  Check,
  Copy,
  Eye,
  Search,
  SearchX,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { AdminDialog } from "@/components/admin/admin-dialog"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { AdminEmptyState } from "@/components/admin/empty-state"
import {
  formatDevelopmentDateTime,
  formatIrrDecimal,
} from "@/lib/admin/format"
import type { AdminApiLog } from "@/server/api/api-logs"

type ApiLogsManagerProps = {
  logs: AdminApiLog[]
  services: string[]
}

type MethodFilter = "ALL" | "POST" | "GET"

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground/60 uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-all text-xs text-foreground sm:text-right">
        {value}
      </dd>
    </div>
  )
}

function statusBadgeVariant(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return "success" as const
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "warning" as const
  }
  return "danger" as const
}

function ApiLogsManager({ logs, services }: ApiLogsManagerProps) {
  const [search, setSearch] = useState("")
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL")
  const [serviceFilter, setServiceFilter] = useState<string>("all")
  const [selectedLog, setSelectedLog] = useState<AdminApiLog | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const stats = useMemo(() => {
    let successCount = 0
    let errorCount = 0
    let postCount = 0
    let getCount = 0

    for (const log of logs) {
      if (log.statusCode >= 200 && log.statusCode < 300) {
        successCount += 1
      } else {
        errorCount += 1
      }
      if (log.method === "POST") {
        postCount += 1
      } else {
        getCount += 1
      }
    }

    return {
      total: logs.length,
      successCount,
      errorCount,
      postCount,
      getCount,
    }
  }, [logs])

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase()

    return logs.filter((log) => {
      if (methodFilter !== "ALL" && log.method !== methodFilter) {
        return false
      }

      if (serviceFilter !== "all" && log.serviceName !== serviceFilter) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        log.requestId,
        log.method,
        log.path,
        String(log.statusCode),
        log.serviceName,
        log.serviceDomain,
        log.keyId,
        log.paymentReference,
        log.externalOrderId,
        log.errorCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [logs, methodFilter, serviceFilter, search])

  const copyText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 1600)
    } catch {
      // Clipboard write unavailable
    }
  }

  const columns: DataTableColumn<AdminApiLog>[] = [
    {
      id: "endpoint",
      header: "Request",
      sortValue: (log) => log.path,
      cell: (log) => (
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={log.method === "POST" ? "info" : "outline"}>
              {log.method}
            </Badge>
            <span className="font-mono text-xs text-foreground">
              {log.path}
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/65">
            {log.requestId}
            {log.paymentReference ? ` · ${log.paymentReference}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "service",
      header: "Service & Token",
      sortValue: (log) => log.serviceName,
      cell: (log) => (
        <div>
          <p className="text-xs font-medium">{log.serviceName}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Key: {log.keyId}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (log) => log.statusCode,
      cell: (log) => (
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant(log.statusCode)}>
            {log.statusCode}
          </Badge>
          {log.replayed ? <Badge variant="outline">Replayed</Badge> : null}
          {log.errorCode ? (
            <span className="font-mono text-[10px] text-danger">
              {log.errorCode}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "amount",
      header: "Amount / Order",
      align: "right",
      sortValue: (log) => Number(log.amount ?? 0),
      cell: (log) => (
        <div>
          <p className="text-xs font-medium">
            {log.amount ? formatIrrDecimal(log.amount) : "—"}
          </p>
          {log.externalOrderId ? (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {log.externalOrderId}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "date",
      header: "Time",
      align: "right",
      sortValue: (log) => log.createdAt,
      cell: (log) => (
        <div>
          <p className="font-mono text-[10px] text-muted-foreground">
            {formatDevelopmentDateTime(log.createdAt)}
          </p>
          {log.durationMs !== null ? (
            <p className="mt-1 font-mono text-[9px] text-muted-foreground/55">
              {log.durationMs} ms
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (log) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`View API call ${log.requestId}`}
          onClick={(event) => {
            event.stopPropagation()
            setSelectedLog(log)
          }}
        >
          <Eye aria-hidden="true" className="size-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Valid API calls
          </p>
          <p className="mt-2 text-2xl font-medium tabular-nums">
            {stats.total}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Authenticated with service token
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            2xx succeeded
          </p>
          <p className="mt-2 text-2xl font-medium text-success tabular-nums">
            {stats.successCount}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            200 OK &amp; 201 Created
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            POST / GET split
          </p>
          <p className="mt-2 text-2xl font-medium tabular-nums">
            {stats.postCount} / {stats.getCount}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Create vs retrieve requests
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            4xx / 5xx responses
          </p>
          <p className="mt-2 text-2xl font-medium text-warning tabular-nums">
            {stats.errorCount}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Validation, conflict, or gateway errors
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              Service API traffic
            </p>
            <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">
              Authenticated requests
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {services.length > 0 ? (
              <select
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
                aria-label="Filter by connected service"
                className="h-8 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All services</option>
                {services.map((serviceName) => (
                  <option key={serviceName} value={serviceName}>
                    {serviceName}
                  </option>
                ))}
              </select>
            ) : null}

            <div
              role="group"
              aria-label="Filter by HTTP method"
              className="inline-flex items-center rounded-xl border border-border bg-white/[0.02] p-0.5"
            >
              {(["ALL", "POST", "GET"] as const).map((method) => {
                const active = methodFilter === method
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setMethodFilter(method)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {method === "ALL" ? "All" : method}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground/60"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requestId, reference, keyId..."
              aria-label="Search API logs"
              className="h-10 pl-9 text-xs"
            />
          </div>
          <span className="font-mono text-[9px] tracking-[0.06em] text-muted-foreground/55 uppercase">
            {filteredLogs.length} of {logs.length} calls
          </span>
        </div>

        <DataTable
          rows={filteredLogs}
          columns={columns}
          getRowId={(log) => log.id}
          onRowClick={(log) => setSelectedLog(log)}
          caption="Authenticated service API requests"
          defaultSort={{ columnId: "date", direction: "desc" }}
          minWidthClassName="min-w-[50rem]"
          emptyState={
            <AdminEmptyState
              icon={search ? SearchX : Activity}
              title={
                search
                  ? "No API calls match your search"
                  : "No authenticated API calls recorded yet"
              }
              description={
                search
                  ? "Clear the search or filters to view recorded API calls."
                  : "Requests to /api/v1/payments authenticated with a valid service token will appear here automatically."
              }
              action={
                search || methodFilter !== "ALL" || serviceFilter !== "all" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("")
                      setMethodFilter("ALL")
                      setServiceFilter("all")
                    }}
                  >
                    Reset filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {selectedLog ? (
        <AdminDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedLog(null)
            }
          }}
          title={`${selectedLog.method} ${selectedLog.path}`}
          description="Authenticated service API call details."
          className="max-w-2xl"
        >
          <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant(selectedLog.statusCode)}>
                HTTP {selectedLog.statusCode}
              </Badge>
              <Badge
                variant={selectedLog.method === "POST" ? "info" : "outline"}
              >
                {selectedLog.method}
              </Badge>
              {selectedLog.simulator !== null ? (
                <Badge
                  variant={selectedLog.simulator ? "warning" : "success"}
                >
                  {selectedLog.simulator ? "Simulator (TEST)" : "Live IPG"}
                </Badge>
              ) : null}
              {selectedLog.replayed ? (
                <Badge variant="outline">Idempotent replay</Badge>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() =>
                  copyText(selectedLog.id, selectedLog.requestId)
                }
              >
                {copiedId === selectedLog.id ? (
                  <Check aria-hidden="true" className="size-3" />
                ) : (
                  <Copy aria-hidden="true" className="size-3" />
                )}
                {copiedId === selectedLog.id ? "Copied" : "Copy requestId"}
              </Button>
            </div>

            <div>
              <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
                Request &amp; authentication
              </p>
              <dl className="mt-2 rounded-xl border border-border bg-white/[0.02] px-4 py-1">
                <DetailRow
                  label="Request ID"
                  value={
                    <span className="font-mono">{selectedLog.requestId}</span>
                  }
                />
                <DetailRow
                  label="Service"
                  value={`${selectedLog.serviceName} (${selectedLog.serviceDomain})`}
                />
                <DetailRow
                  label="Token Key ID"
                  value={<span className="font-mono">{selectedLog.keyId}</span>}
                />
                <DetailRow
                  label="Endpoint"
                  value={
                    <span className="font-mono">
                      {selectedLog.method} {selectedLog.path}
                    </span>
                  }
                />
                <DetailRow
                  label="Timestamp"
                  value={formatDevelopmentDateTime(selectedLog.createdAt)}
                />
                <DetailRow
                  label="Duration"
                  value={
                    selectedLog.durationMs !== null
                      ? `${selectedLog.durationMs} ms`
                      : "—"
                  }
                />
                {selectedLog.idempotencyKey ? (
                  <DetailRow
                    label="Idempotency-Key"
                    value={
                      <span className="font-mono">
                        {selectedLog.idempotencyKey}
                      </span>
                    }
                  />
                ) : null}
                {selectedLog.paymentReference ? (
                  <DetailRow
                    label="Payment Reference"
                    value={
                      <span className="font-mono">
                        {selectedLog.paymentReference}
                      </span>
                    }
                  />
                ) : null}
                {selectedLog.externalOrderId ? (
                  <DetailRow
                    label="External Order ID"
                    value={
                      <span className="font-mono">
                        {selectedLog.externalOrderId}
                      </span>
                    }
                  />
                ) : null}
                {selectedLog.amount ? (
                  <DetailRow
                    label="Amount"
                    value={formatIrrDecimal(selectedLog.amount)}
                  />
                ) : null}
                {selectedLog.ip ? (
                  <DetailRow
                    label="Client IP"
                    value={<span className="font-mono">{selectedLog.ip}</span>}
                  />
                ) : null}
                {selectedLog.userAgent ? (
                  <DetailRow
                    label="User-Agent"
                    value={
                      <span className="font-mono">{selectedLog.userAgent}</span>
                    }
                  />
                ) : null}
                {selectedLog.errorCode ? (
                  <DetailRow
                    label="Error"
                    value={
                      <span className="text-danger">
                        {selectedLog.errorCode}
                        {selectedLog.errorMessage
                          ? ` — ${selectedLog.errorMessage}`
                          : ""}
                      </span>
                    }
                  />
                ) : null}
              </dl>
            </div>

            {selectedLog.requestBody ? (
              <div>
                <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
                  Request payload
                </p>
                <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
                  {JSON.stringify(selectedLog.requestBody, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end border-t border-border pt-5">
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </div>
        </AdminDialog>
      ) : null}
    </>
  )
}

export { ApiLogsManager }

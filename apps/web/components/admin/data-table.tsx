"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

type SortDirection = "asc" | "desc"

export type DataTableColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  align?: "left" | "right"
  className?: string
}

type DataTableProps<T> = {
  rows: T[]
  columns: DataTableColumn<T>[]
  getRowId: (row: T) => string
  caption: string
  emptyState: ReactNode
  defaultSort?: {
    columnId: string
    direction: SortDirection
  }
  minWidthClassName?: string
  className?: string
}

function DataTable<T>({
  rows,
  columns,
  getRowId,
  caption,
  emptyState,
  defaultSort,
  minWidthClassName = "min-w-[44rem]",
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort ?? null)

  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows
    }

    const column = columns.find((item) => item.id === sort.columnId)

    if (!column?.sortValue) {
      return rows
    }

    return [...rows].sort((left, right) => {
      const leftValue = column.sortValue?.(left)
      const rightValue = column.sortValue?.(right)

      if (leftValue === undefined || rightValue === undefined) {
        return 0
      }

      const comparison =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue))

      return sort.direction === "asc" ? comparison : -comparison
    })
  }, [rows, columns, sort])

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!column.sortValue) {
      return
    }

    setSort((current) => {
      if (current?.columnId !== column.id) {
        return { columnId: column.id, direction: "asc" }
      }

      return {
        columnId: column.id,
        direction: current.direction === "asc" ? "desc" : "asc",
      }
    })
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table
        className={cn("w-full border-collapse text-left", minWidthClassName)}
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => {
              const active = sort?.columnId === column.id
              const SortIcon = !active
                ? ArrowUpDown
                : sort.direction === "asc"
                  ? ArrowUp
                  : ArrowDown

              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    active
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={cn(
                    "px-4 py-3 font-mono text-[9px] font-medium tracking-[0.12em] text-muted-foreground/60 uppercase first:pl-5 last:pr-5",
                    column.align === "right" && "text-right",
                    column.className
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                        column.align === "right" && "ml-auto"
                      )}
                    >
                      {column.header}
                      <SortIcon aria-hidden="true" className="size-3" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyState}</td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr
                key={getRowId(row)}
                className="border-b border-border/80 transition-colors last:border-b-0 hover:bg-white/[0.02]"
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "px-4 py-4 align-middle text-sm first:pl-5 last:pr-5",
                      column.align === "right" && "text-right tabular-nums",
                      column.className
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export { DataTable }
export type { DataTableProps, SortDirection }

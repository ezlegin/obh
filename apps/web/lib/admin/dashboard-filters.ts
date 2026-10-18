export type TransactionStatusFilter = "all" | "completed" | "pending" | "failed"

export type DashboardFilters = {
  status: TransactionStatusFilter
  service: string
  from: string
  to: string
}

export const defaultDashboardFilters: DashboardFilters = {
  status: "all",
  service: "all",
  from: "",
  to: "",
}

export function countActiveDashboardFilters(filters: DashboardFilters) {
  return [
    filters.status !== "all",
    filters.service !== "all",
    Boolean(filters.from),
    Boolean(filters.to),
  ].filter(Boolean).length
}

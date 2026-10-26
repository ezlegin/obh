"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@workspace/ui/components/badge"

import { formatCompactIrr, formatIrr } from "@/lib/admin/format"

type CashflowPoint = {
  label: string
  revenue: number
  expenses: number
}

type CashflowChartProps = {
  data: readonly CashflowPoint[]
  rangeLabel: string
  badgeLabel?: string
}

function CashflowChart({
  data,
  rangeLabel,
  badgeLabel = "Last 30 days",
}: CashflowChartProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card/40 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Cash movement
          </p>
          <h2 className="mt-2 text-xl font-medium tracking-[-0.025em]">
            Revenue and expenses
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Recorded movement for {rangeLabel}, in R.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="outline">{badgeLabel}</Badge>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.06em] text-muted-foreground/70 uppercase">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-success"
              />
              Revenue
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.06em] text-muted-foreground/70 uppercase">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-info"
              />
              Expenses
            </span>
          </div>
        </div>
      </div>

      <div
        className="mt-7 h-[320px] w-full"
        role="img"
        aria-label={`Chart showing daily revenue and expenses for ${rangeLabel}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={[...data]}
            margin={{ top: 6, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="obh-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7dca9d" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#7dca9d" stopOpacity={0} />
              </linearGradient>
              <linearGradient
                id="obh-expenses-fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#86a9e0" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#86a9e0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="rgba(255,255,255,0.07)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: "#8b8b84", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={38}
              tick={{ fill: "#8b8b84", fontSize: 10 }}
              tickFormatter={(value: number) => formatCompactIrr(value)}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.12)" }}
              contentStyle={{
                backgroundColor: "#0b0b0b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 11,
                color: "#f3f3ef",
              }}
              labelStyle={{ color: "#9b9b95", marginBottom: 6 }}
              formatter={(value, name) => [
                formatIrr(Number(value)),
                name === "revenue" ? "Revenue" : "Expenses",
              ]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#7dca9d"
              strokeWidth={2}
              fill="url(#obh-revenue-fill)"
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#86a9e0"
              strokeWidth={2}
              fill="url(#obh-expenses-fill)"
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export { CashflowChart }

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect } from "@workspace/ui/components/native-select"

import { AdminDialog } from "@/components/admin/admin-dialog"
import {
  defaultDashboardFilters,
  type DashboardFilters,
} from "@/lib/admin/dashboard-filters"
import { services } from "@/lib/site"

const filterSchema = z
  .object({
    status: z.enum(["all", "completed", "pending", "failed"]),
    service: z.string().min(1),
    from: z.string(),
    to: z.string(),
  })
  .refine((values) => !values.from || !values.to || values.from <= values.to, {
    message: "End date must be on or after the start date.",
    path: ["to"],
  })

type FilterValues = z.infer<typeof filterSchema>

type TransactionFilterDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFilters: DashboardFilters
  onApply: (filters: DashboardFilters) => void
}

function TransactionFilterDialog({
  open,
  onOpenChange,
  initialFilters,
  onApply,
}: TransactionFilterDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: initialFilters,
  })

  useEffect(() => {
    if (open) {
      reset(initialFilters)
    }
  }, [open, initialFilters, reset])

  const applyFilters = (values: FilterValues) => {
    onApply(values)
    onOpenChange(false)
  }

  const clearFilters = () => {
    reset(defaultDashboardFilters)
    onApply(defaultDashboardFilters)
    onOpenChange(false)
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Filter dashboard"
      description="Filter the sample transactions by status, connected service, or date. These controls do not query the database."
    >
      <form onSubmit={handleSubmit(applyFilters)} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="filter-status">Status</Label>
            <div className="relative">
              <NativeSelect id="filter-status" {...register("status")}>
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </NativeSelect>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-service">Service</Label>
            <div className="relative">
              <NativeSelect id="filter-service" {...register("service")}>
                <option value="all">All services</option>
                {services.map((service) => (
                  <option key={service.href} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </NativeSelect>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-from">From</Label>
            <Input
              id="filter-from"
              type="date"
              aria-invalid={Boolean(errors.from)}
              {...register("from")}
            />
            {errors.from ? (
              <p className="text-xs text-danger">{errors.from.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-to">To</Label>
            <Input
              id="filter-to"
              type="date"
              aria-invalid={Boolean(errors.to)}
              aria-describedby={errors.to ? "filter-to-error" : undefined}
              {...register("to")}
            />
            {errors.to ? (
              <p id="filter-to-error" className="text-xs text-danger">
                {errors.to.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            className="justify-center"
          >
            Clear all
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Apply filters</Button>
          </div>
        </div>
      </form>
    </AdminDialog>
  )
}

export { TransactionFilterDialog }

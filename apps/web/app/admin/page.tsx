import type { Metadata } from "next"
import { ArrowRight, Database, LockKeyhole, ShieldCheck } from "lucide-react"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"

import { AdminPageHeader } from "@/components/admin/admin-page"
import { adminNavItems } from "@/lib/admin/navigation"

export const metadata: Metadata = {
  title: {
    absolute: "Dashboard — OBH Admin",
  },
}

const foundationStatus = [
  {
    title: "Authentication",
    value: "Active",
    description:
      "Sessions are signed and verified on the server. Admin access is checked again against the active manager record.",
    icon: ShieldCheck,
    badge: "success" as const,
  },
  {
    title: "Data foundation",
    value: "Schema ready",
    description:
      "The PostgreSQL schema and initial migration are in place. No business records are created by this foundation view.",
    icon: Database,
    badge: "info" as const,
  },
  {
    title: "Business modules",
    value: "Not enabled",
    description:
      "Payments, accounting, ownership, and reporting are intentionally locked until their implementation steps.",
    icon: LockKeyhole,
    badge: "warning" as const,
  },
] as const

export default function AdminDashboardPage() {
  const moduleLinks = adminNavItems.filter((item) => !item.exact)

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin / Overview"
        title="The operating foundation is in place."
        description="Authentication, protected navigation, and the database boundary are active. This overview is intentionally empty of financial figures until the dashboard module is implemented."
        actions={
          <Badge variant="success">
            <span
              aria-hidden="true"
              className="size-1 rounded-full bg-success"
            />
            Secure session
          </Badge>
        }
      />

      <section aria-labelledby="foundation-heading" className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="foundation-heading"
            className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70 uppercase"
          >
            Foundation status
          </h2>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {foundationStatus.map((item) => {
            const Icon = item.icon

            return (
              <article
                key={item.title}
                className="rounded-2xl border border-border bg-card/40 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-9 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <Badge variant={item.badge}>{item.value}</Badge>
                </div>
                <h3 className="mt-5 text-sm font-medium">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {item.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="modules-heading" className="mt-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70 uppercase">
              Modules
            </p>
            <h2
              id="modules-heading"
              className="mt-3 text-2xl font-semibold tracking-[-0.035em]"
            >
              Protected routes, ready for their data.
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">
            Each destination is guarded by the same session check. Modules will
            be enabled one at a time.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {moduleLinks.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card/30 p-5 transition-colors duration-200 hover:border-white/15 hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-9 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground transition-colors group-hover:text-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground/35 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </div>
                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{item.label}</h3>
                    <span className="font-mono text-[8px] tracking-[0.1em] text-warning/80 uppercase">
                      Reserved
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-card/30 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-medium">
              No financial data is displayed here yet.
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
              The next dashboard iteration will read real records only. There
              are no mock balances, placeholder transactions, or simulated
              totals in this admin shell.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

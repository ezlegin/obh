import { ArrowUpRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { services } from "@/lib/site"

type ServiceDirectoryProps = {
  labels: {
    visit: string
    opensInNewTab: string
  }
  size?: "default" | "large"
  className?: string
}

function ServiceDirectory({
  labels,
  size = "default",
  className,
}: ServiceDirectoryProps) {
  return (
    <div className={cn("border-t border-border", className)}>
      {services.map((service, index) => (
        <a
          key={service.href}
          href={service.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border py-5 transition-colors duration-300 hover:bg-white/[0.025] focus-visible:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-inset sm:gap-5 sm:py-6"
        >
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground/70">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <span
              className={cn(
                "text-lg font-medium tracking-[-0.025em] transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1",
                size === "large" &&
                  "text-2xl sm:text-3xl lg:text-[2.4rem] lg:leading-none"
              )}
            >
              {service.name}
            </span>
            <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              {service.domain}
            </span>
          </span>
          <span className="flex items-center gap-3 text-muted-foreground">
            <span className="hidden text-[10px] tracking-[0.16em] uppercase sm:inline">
              {labels.visit}
            </span>
            <span className="flex size-9 items-center justify-center rounded-full border border-transparent transition-colors duration-300 group-hover:border-border group-hover:bg-white/[0.04] group-hover:text-foreground">
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
              />
            </span>
            <span className="sr-only"> {labels.opensInNewTab}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

export { ServiceDirectory }

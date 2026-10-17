import { Logo } from "@/components/logo"
import { services } from "@/lib/site"

const nodePositions = [
  "left-1/2 top-[2%]",
  "left-[87%] top-[27%]",
  "left-[87%] top-[73%]",
  "left-1/2 top-[98%]",
  "left-[13%] top-[73%]",
  "left-[13%] top-[27%]",
] as const

function HeroOrbit() {
  return (
    <div className="rounded-[2rem] border border-border bg-white/[0.015] p-4 shadow-glow backdrop-blur-sm sm:p-5">
      <div className="flex items-center justify-between gap-4 px-1 pb-3">
        <span className="eyebrow">System map</span>
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground/60 uppercase">
          Services / Core
        </span>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[33rem]">
        <div
          aria-hidden="true"
          className="absolute inset-[1%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgb(255_255_255/0.035),transparent_64%)]"
        />
        <div
          aria-hidden="true"
          className="animate-slow-spin absolute inset-[13%] rounded-full border border-dashed border-white/10"
        >
          <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70" />
        </div>
        <div
          aria-hidden="true"
          className="animate-soft-pulse absolute inset-[28%] rounded-full border border-white/[0.07]"
        />

        <div className="absolute top-1/2 left-1/2 z-10 flex size-[30%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0b0b0b] shadow-[0_0_60px_rgb(0_0_0/0.85)]">
          <span
            aria-hidden="true"
            className="animate-slow-spin absolute inset-2 rounded-full border border-dashed border-white/10"
          />
          <Logo className="relative w-[46%]" />
        </div>

        {services.map((service, index) => (
          <div
            key={service.href}
            className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 ${nodePositions[index]}`}
          >
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-foreground/75 ring-4 ring-background/80"
            />
            <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 font-mono text-[9px] tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase backdrop-blur-sm">
              {service.name}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border px-1 pt-4">
        {["Payments", "Accounting", "Ownership"].map((label) => (
          <span
            key={label}
            className="flex items-center gap-2 font-mono text-[9px] tracking-[0.1em] text-muted-foreground/70 uppercase"
          >
            <span
              aria-hidden="true"
              className="size-1 rounded-full bg-white/35"
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export { HeroOrbit }

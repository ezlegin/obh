import { ArrowRight } from "lucide-react"

import { StatusPill } from "@/components/status-pill"

const outcomes = [
  {
    status: "completed" as const,
    text: "Provider verification succeeded. Fulfil the order.",
  },
  {
    status: "failed" as const,
    text: "Verification or provider processing failed.",
  },
  {
    status: "cancelled" as const,
    text: "Cancelled by an authorized process.",
  },
  {
    status: "expired" as const,
    text: "The checkout session expired without success.",
  },
]

export function LifecycleDiagram() {
  return (
    <div className="not-prose my-6 rounded-xl border border-white/10 bg-white/[0.015] p-5">
      <div className="grid items-center gap-5 sm:grid-cols-[1fr_auto_1.2fr]">
        <div>
          <p className="text-[0.62rem] font-medium tracking-[0.13em] text-white/35 uppercase">
            Created
          </p>
          <div className="mt-2.5">
            <StatusPill status="pending" />
          </div>
          <p className="mt-2.5 text-[0.78rem] leading-relaxed text-muted-foreground">
            A provider session exists or is being created. The result is not
            verified yet.
          </p>
        </div>

        <ArrowRight
          aria-hidden="true"
          className="mx-auto hidden size-5 text-white/20 sm:block"
        />

        <div>
          <p className="text-[0.62rem] font-medium tracking-[0.13em] text-white/35 uppercase">
            Terminal outcomes
          </p>
          <ul className="mt-2.5 space-y-2">
            {outcomes.map((outcome) => (
              <li key={outcome.status} className="flex items-start gap-2.5">
                <StatusPill status={outcome.status} className="shrink-0" />
                <span className="text-[0.75rem] leading-relaxed text-muted-foreground">
                  {outcome.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 border-t border-white/[0.07] pt-3.5 text-[0.72rem] text-white/35">
        A terminal payment never transitions again. A pending payment can move
        to any terminal outcome.
      </p>
    </div>
  )
}

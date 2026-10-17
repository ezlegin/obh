import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

type SectionLabelProps = {
  index: string
  children: ReactNode
  className?: string
}

function SectionLabel({ index, children, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted-foreground/70">
        {index}
      </span>
      <span aria-hidden="true" className="h-px w-6 bg-white/15" />
      <span className="eyebrow">{children}</span>
    </div>
  )
}

export { SectionLabel }

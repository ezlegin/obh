import type { ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

const variantStyles = {
  note: {
    wrapper: "border-white/10 bg-white/[0.025]",
    label: "text-muted-foreground",
    title: "Note",
  },
  tip: {
    wrapper: "border-success/25 bg-success/[0.05]",
    label: "text-success",
    title: "Tip",
  },
  warning: {
    wrapper: "border-warning/30 bg-warning/[0.06]",
    label: "text-warning",
    title: "Important",
  },
  danger: {
    wrapper: "border-danger/30 bg-danger/[0.06]",
    label: "text-danger",
    title: "Warning",
  },
} as const

type CalloutProps = {
  variant?: keyof typeof variantStyles
  title?: string
  children: ReactNode
  className?: string
}

export function Callout({
  variant = "note",
  title,
  children,
  className,
}: CalloutProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "not-prose my-6 rounded-lg border px-4 py-3.5 text-[0.85rem] leading-relaxed text-[#b6b6ae]",
        styles.wrapper,
        className
      )}
    >
      <p
        className={cn(
          "mb-1.5 text-[0.65rem] font-medium tracking-[0.12em] uppercase",
          styles.label
        )}
      >
        {title ?? styles.title}
      </p>
      <div className="[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:border [&_code]:border-white/10 [&_code]:bg-white/[0.05] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.78em] [&_code]:text-[#e9e9e2] [&_p+p]:mt-2 [&_strong]:text-foreground [&>p]:my-0">
        {children}
      </div>
    </div>
  )
}

import type { ComponentProps } from "react"

import { cn } from "cn"

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-input bg-white/[0.035] px-3.5 py-2 text-sm text-foreground shadow-sm transition-[border-color,background-color,box-shadow] outline-none placeholder:text-muted-foreground/55 focus-visible:border-ring focus-visible:bg-white/[0.05] focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }

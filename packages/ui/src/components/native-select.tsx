import type { ComponentProps } from "react"

import { cn } from "cn"

function NativeSelect({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-input bg-white/[0.035] px-3.5 pr-9 text-sm text-foreground scheme-dark shadow-sm transition-[border-color,background-color,box-shadow] outline-none focus-visible:border-ring focus-visible:bg-white/[0.05] focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 [&>optgroup]:bg-[#0b0b0b] [&>optgroup]:text-foreground [&>option]:bg-[#0b0b0b] [&>option]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { NativeSelect }

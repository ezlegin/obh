import type { ComponentProps } from "react"

import { cn } from "cn"

function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-none font-medium tracking-[0.01em] text-foreground select-none",
        className
      )}
      {...props}
    />
  )
}

export { Label }

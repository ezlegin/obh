import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { cn } from "cn"

const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.625rem] font-medium tracking-[0.13em] whitespace-nowrap uppercase",
  {
    variants: {
      variant: {
        default: "border-border bg-white/[0.04] text-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        muted: "border-transparent bg-secondary text-muted-foreground",
        success: "border-success/20 bg-success/10 text-success",
        info: "border-info/20 bg-info/10 text-info",
        warning: "border-warning/20 bg-warning/10 text-warning",
        danger: "border-danger/20 bg-danger/10 text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

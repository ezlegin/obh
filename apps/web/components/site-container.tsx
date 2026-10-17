import type { ComponentProps } from "react"

import { cn } from "@workspace/ui/lib/utils"

function SiteContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("site-container", className)} {...props} />
}

export { SiteContainer }

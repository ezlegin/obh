import Image from "next/image"

import { cn } from "@workspace/ui/lib/utils"

type LogoProps = {
  className?: string
}

function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/obh-logo.svg"
      alt="OBH"
      width={235}
      height={87}
      loading="eager"
      draggable={false}
      className={cn("h-6 w-auto select-none", className)}
    />
  )
}

export { Logo }

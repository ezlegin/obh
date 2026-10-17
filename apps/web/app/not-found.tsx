import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@workspace/ui/components/button"

import { Logo } from "@/components/logo"

export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div aria-hidden="true" className="hero-grid absolute inset-0 -z-20" />
      <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10" />

      <Link
        href="/"
        aria-label="OBH home"
        className="rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Logo className="h-7" />
      </Link>

      <p className="eyebrow mt-14">Error 404</p>
      <h1 className="mt-5 max-w-2xl text-4xl leading-[1.02] font-semibold tracking-[-0.055em] text-balance sm:text-5xl lg:text-6xl">
        This page could not be found.
      </h1>
      <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
        The address may have changed, or the page may no longer exist. Return to
        the OBH homepage to continue.
      </p>

      <Link href="/" className={`${buttonVariants({ size: "lg" })} mt-8`}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Return to OBH
      </Link>
    </div>
  )
}

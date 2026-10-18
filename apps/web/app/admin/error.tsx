"use client"

import { AlertTriangle, RotateCcw } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@workspace/ui/components/button"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin route error", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-danger/20 bg-danger/[0.035] p-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full border border-danger/20 bg-danger/10 text-danger">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-5 text-xl font-medium tracking-[-0.03em]">
          This admin page could not be loaded
        </h1>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          The operation failed safely. No partial action was confirmed. Retry
          the page, and if the issue persists check the server logs.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[9px] text-muted-foreground/60">
            Reference: {error.digest}
          </p>
        ) : null}
        <Button type="button" className="mt-6" onClick={reset}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Retry
        </Button>
      </div>
    </div>
  )
}

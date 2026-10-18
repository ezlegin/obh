"use client"

import { AlertTriangle, RotateCcw } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@workspace/ui/components/button"

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error", error)
  }, [error])

  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-md rounded-2xl border border-danger/20 bg-danger/[0.035] p-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full border border-danger/20 bg-danger/10 text-danger">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-5 text-xl font-medium tracking-[-0.03em]">
          Something went wrong
        </h1>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          The page could not be completed. Retry the request. No payment or
          financial action should be assumed successful without confirmation.
        </p>
        <Button type="button" className="mt-6" onClick={reset}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Retry
        </Button>
      </div>
    </main>
  )
}

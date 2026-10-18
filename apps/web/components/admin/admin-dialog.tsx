"use client"

import { X } from "lucide-react"
import { useEffect, useId, useRef, type ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

type AdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: AdminDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal()
      }
      document.body.style.overflow = "hidden"
    } else {
      if (dialog.open) {
        dialog.close()
      }
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false)
        }
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-xl border-0 bg-transparent p-0 text-foreground"
    >
      <div
        className={cn(
          "max-h-[calc(100dvh-2rem)] animate-in overflow-y-auto rounded-2xl border border-border bg-[#0b0b0b] shadow-2xl duration-200 zoom-in-95 fade-in",
          className
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-border p-5 sm:p-6">
          <div>
            <h2 id={titleId} className="text-lg font-medium tracking-[-0.02em]">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-2 max-w-md text-xs leading-5 text-muted-foreground"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => onOpenChange(false)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-white/[0.055] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </dialog>
  )
}

export { AdminDialog }

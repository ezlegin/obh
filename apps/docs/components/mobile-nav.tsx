"use client"

import { Menu, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { SidebarNav } from "@/components/sidebar-nav"

export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground lg:hidden"
      >
        <Menu aria-hidden="true" className="size-4" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Documentation navigation"
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault()
          setOpen(false)
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-[#080808] p-0 text-foreground backdrop:bg-black/70"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <span className="text-[0.8rem] font-medium text-foreground">
            Documentation
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="h-[calc(100dvh-4rem)] overflow-y-auto px-5 py-6 docs-scroll">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </dialog>
    </>
  )
}

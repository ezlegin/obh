"use client"

import { ArrowUpRight, LogOut, Menu, ShieldCheck, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { Logo } from "@/components/logo"
import { logoutAction } from "@/lib/auth/actions"
import {
  adminNavigation,
  adminNavItems,
  isAdminNavActive,
} from "@/lib/admin/navigation"

type AdminUser = {
  name: string | null
  email: string
}

type AdminSidebarContentProps = {
  user: AdminUser
  onNavigate?: () => void
  onClose?: () => void
}

function getInitials(user: AdminUser) {
  const source = user.name?.trim() || user.email
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

function AdminSidebarContent({
  user,
  onNavigate,
  onClose,
}: AdminSidebarContentProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-[#090909]">
      <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            aria-label="OBH admin home"
            onClick={onNavigate}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Logo className="h-6" />
          </Link>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[8px] tracking-[0.14em] text-muted-foreground uppercase">
            Admin
          </span>
        </div>

        {onClose ? (
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-white/[0.055] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Admin navigation"
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-6"
      >
        {adminNavigation.map((group) => (
          <div key={group.label} className="mb-7 last:mb-0">
            <p className="px-3 pb-2 font-mono text-[9px] tracking-[0.16em] text-muted-foreground/55 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = !item.disabled && isAdminNavActive(item, pathname)

                if (item.disabled) {
                  return (
                    <div
                      key={item.label}
                      aria-disabled="true"
                      className="flex h-10 cursor-not-allowed items-center justify-between gap-3 rounded-xl px-3 text-[13px] text-muted-foreground/45 select-none"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground/35"
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge ? (
                        <span className="rounded-full border border-border/70 bg-white/[0.02] px-2 py-0.5 font-mono text-[8px] tracking-[0.12em] text-muted-foreground/55 uppercase">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-10 items-center justify-between gap-3 rounded-xl px-3 text-[13px] text-muted-foreground transition-colors duration-200 hover:bg-white/[0.045] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                      active &&
                        "bg-white/[0.06] text-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground/70 transition-colors",
                          active && "text-foreground"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge ? (
                      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[8px] tracking-[0.12em] text-muted-foreground uppercase">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-9 items-center justify-between rounded-xl px-3 text-xs text-muted-foreground transition-colors hover:bg-white/[0.045] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          View public site
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>

        <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] p-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[11px] font-medium tracking-[0.04em]"
          >
            {getInitials(user)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {user.name || "Manager"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {user.email}
            </p>
          </div>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.055] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <LogOut aria-hidden="true" className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

type AdminShellProps = {
  user: AdminUser
  children: ReactNode
}

function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const activeItem = adminNavItems.find((item) =>
    isAdminNavActive(item, pathname)
  )

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (isMenuOpen) {
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
  }, [isMenuOpen])

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-border lg:block">
        <AdminSidebarContent user={user} />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 flex h-[4.5rem] items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <button
            type="button"
            aria-label="Open admin navigation"
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            aria-controls="admin-navigation"
            onClick={() => setIsMenuOpen(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-white/[0.055] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none lg:hidden"
          >
            <Menu aria-hidden="true" className="size-4" />
          </button>

          <div className="min-w-0">
            <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
              OBH / Admin
            </p>
            <p className="truncate text-sm font-medium tracking-[-0.01em]">
              {activeItem?.label ?? "Admin"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-border bg-white/[0.025] px-3 py-1.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground/70 uppercase sm:flex">
              <ShieldCheck aria-hidden="true" className="size-3" />
              Server verified
            </span>
          </div>
        </header>

        <main id="main-content" className="flex-1">
          <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>

      <dialog
        id="admin-navigation"
        ref={dialogRef}
        aria-label="Admin navigation"
        onClose={() => setIsMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsMenuOpen(false)
          }
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/75 backdrop:backdrop-blur-sm lg:hidden"
      >
        <div className="ml-auto h-dvh w-[min(92vw,20rem)] animate-in border-l border-border shadow-2xl duration-300 fade-in slide-in-from-right-4">
          <AdminSidebarContent
            user={user}
            onNavigate={() => setIsMenuOpen(false)}
            onClose={() => setIsMenuOpen(false)}
          />
        </div>
      </dialog>
    </div>
  )
}

export { AdminShell }

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@workspace/ui/lib/utils"

import { navigation } from "@/lib/docs/navigation"

function isActivePath(pathname: string, href: string) {
  if (href === "/docs") {
    return pathname === "/docs"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Documentation" className="space-y-7">
      {navigation.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-2 text-[0.63rem] font-medium tracking-[0.14em] text-white/35 uppercase">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    className={cn("docs-nav-link")}
                  >
                    {Icon ? (
                      <Icon
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-white/30"
                      />
                    ) : null}
                    <span className="truncate">{item.title}</span>
                    {item.badge ? (
                      <span className="ml-auto rounded border border-white/10 px-1 py-px font-mono text-[0.55rem] text-muted-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

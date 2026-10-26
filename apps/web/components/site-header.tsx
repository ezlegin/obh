"use client"

import { ArrowRight, Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { LanguageSwitch } from "@/components/language-switch"
import { Logo } from "@/components/logo"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"
import { services } from "@/lib/site"

type SiteHeaderProps = {
  locale: Locale
  labels: Dictionary["header"]
  navigation: Dictionary["nav"]
}

function isActivePath(pathname: string, href: string) {
  const path = href.split("#")[0] || "/"

  if (path === "/" || path === "/fa") {
    return pathname === path
  }

  return pathname === path || pathname.startsWith(`${path}/`)
}

function SiteHeader({ locale, labels, navigation }: SiteHeaderProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const t = labels

  const navigationItems = [
    {
      label: navigation.ecosystem,
      href: localizeHref(locale, "/#services"),
    },
    {
      label: navigation.corporation,
      href: localizeHref(locale, "/about-us"),
    },
    { label: navigation.terms, href: localizeHref(locale, "/terms") },
  ]

  const languageLabels = {
    language: t.language,
    english: t.english,
    persian: t.persian,
  }

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
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <SiteContainer className="flex h-[4.5rem] items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href={localizeHref(locale, "/")}
            aria-label={t.homeLabel}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <Logo className="h-[1.375rem] sm:h-6" />
          </Link>

          <nav
            aria-label={t.primaryNav}
            className="hidden items-center gap-1 md:flex"
          >
            {navigationItems.map((item) => {
              const active = isActivePath(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center rounded-full px-3.5 text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                    active &&
                      "bg-white/[0.045] text-foreground hover:bg-white/[0.06]"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitch
            locale={locale}
            labels={languageLabels}
            className="shrink-0"
          />
          <Link
            href={localizeHref(locale, "/contact-us")}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pe-3.5"
            )}
          >
            {t.startConversation}
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 rtl:-scale-x-100"
            />
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitch locale={locale} labels={languageLabels} />
          <button
            type="button"
            aria-label={t.openMenu}
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen(true)}
            className="flex size-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-white/[0.055] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <Menu aria-hidden="true" className="size-4.5" />
          </button>
        </div>
      </SiteContainer>

      <dialog
        id="mobile-navigation"
        ref={dialogRef}
        aria-label={t.siteNav}
        onClose={() => setIsMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsMenuOpen(false)
          }
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      >
        <div className="ms-auto flex h-dvh w-[min(92vw,25rem)] animate-in flex-col border-s border-border bg-[#0a0a0a] shadow-2xl duration-300 fade-in slide-in-from-right-4">
          <div className="flex h-[4.5rem] shrink-0 items-center justify-between gap-3 border-b border-border px-5">
            <Link
              href={localizeHref(locale, "/")}
              aria-label={t.homeLabel}
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Logo className="h-[1.375rem]" />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitch locale={locale} labels={languageLabels} />
              <button
                type="button"
                aria-label={t.closeMenu}
                onClick={() => setIsMenuOpen(false)}
                className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-white/[0.055] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-8">
            <p className="eyebrow">{t.navigate}</p>
            <nav aria-label={t.mobileNav} className="mt-5 flex flex-col">
              {navigationItems.map((item, index) => {
                const active = isActivePath(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                    className="group flex items-center justify-between border-b border-border py-4 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-[10px] text-muted-foreground/70">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "text-2xl font-medium tracking-[-0.035em] text-muted-foreground transition-colors group-hover:text-foreground",
                          active && "text-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground/50 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground rtl:-scale-x-100"
                    />
                  </Link>
                )
              })}
            </nav>

            <div className="mt-10">
              <p className="eyebrow">{t.ecosystemSection}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {services.map((service) => (
                  <a
                    key={service.href}
                    href={service.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-xl border border-border px-3 py-2.5 font-mono text-[10px] tracking-[0.04em] text-muted-foreground uppercase transition-colors hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {service.name}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border p-5">
            <Link
              href={localizeHref(locale, "/contact-us")}
              onClick={() => setIsMenuOpen(false)}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              {t.startConversation}
              <ArrowRight
                aria-hidden="true"
                className="size-4 rtl:-scale-x-100"
              />
            </Link>
            <p className="mt-3 text-center font-mono text-[9px] tracking-[0.12em] text-muted-foreground/50 uppercase">
              {t.corporation}
            </p>
          </div>
        </div>
      </dialog>
    </header>
  )
}

export { SiteHeader }

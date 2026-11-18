"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@workspace/ui/lib/utils"

import { EnglishFlag, PersianFlag } from "@/components/flags"
import type { Locale } from "@/lib/i18n/config"
import { localeSwitchHref } from "@/lib/i18n/links"

type LanguageSwitchProps = {
  locale: Locale
  labels: {
    language: string
    english: string
    persian: string
  }
  className?: string
}

const options = [
  { locale: "en", code: "EN", Flag: EnglishFlag, labelKey: "english" },
  { locale: "fa", code: "FA", Flag: PersianFlag, labelKey: "persian" },
] as const

function LanguageSwitch({ locale, labels, className }: LanguageSwitchProps) {
  const pathname = usePathname()

  return (
    <div
      dir="ltr"
      role="group"
      aria-label={labels.language}
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-border bg-white/[0.02] p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const active = option.locale === locale
        const Flag = option.Flag

        return (
          <Link
            key={option.locale}
            href={localeSwitchHref(pathname, option.locale)}
            hrefLang={option.locale}
            aria-current={active ? "true" : undefined}
            aria-label={labels[option.labelKey]}
            title={labels[option.labelKey]}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              active
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
            )}
          >
            <Flag className="h-2.5 w-4 shrink-0 rounded-[1px] ring-1 ring-white/20" />
            <span className="font-mono tracking-[0.08em]">{option.code}</span>
          </Link>
        )
      })}
    </div>
  )
}

export { LanguageSwitch }

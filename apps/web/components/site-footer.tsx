import { ArrowRight, ArrowUpRight, Mail, MapPin, Phone } from "lucide-react"
import Link from "next/link"

import { SiteContainer } from "@/components/site-container"
import { Logo } from "@/components/logo"
import { getContactDetails, phoneHref } from "@/lib/contact"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"
import { services } from "@/lib/site"

type SiteFooterProps = {
  locale: Locale
  dictionary: Dictionary
}

function SiteFooter({ locale, dictionary }: SiteFooterProps) {
  const year = new Date().getFullYear()
  const t = dictionary.footer
  const details = getContactDetails()

  const navigation = [
    { label: t.links.services, href: localizeHref(locale, "/#services") },
    { label: t.links.plans, href: localizeHref(locale, "/#plans") },
    { label: t.links.checkout, href: localizeHref(locale, "/checkout") },
    { label: t.links.about, href: localizeHref(locale, "/about-us") },
    { label: t.links.contact, href: localizeHref(locale, "/contact-us") },
    { label: t.links.terms, href: localizeHref(locale, "/terms") },
  ]

  return (
    <footer className="border-t border-border bg-[#050505]">
      <SiteContainer>
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.55fr_0.85fr_1fr] lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href={localizeHref(locale, "/")}
              aria-label={dictionary.header.homeLabel}
              className="inline-block rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Logo className="h-7" />
            </Link>
            <p className="mt-6 max-w-xs text-sm leading-6 text-muted-foreground">
              {t.tagline}
            </p>
            <p className="mt-8 font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70 uppercase">
              {t.motto}
            </p>
          </div>

          <div>
            <p className="eyebrow">{t.navigate}</p>
            <ul className="mt-5 space-y-3">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow">{t.ecosystem}</p>
            <ul className="mt-5 space-y-3">
              {services.map((service) => (
                <li key={service.href}>
                  <a
                    href={service.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {service.domain}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3 text-muted-foreground/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow">{t.contact}</p>
            <ul className="mt-5 space-y-3">
              {details.phone ? (
                <li>
                  <a
                    href={phoneHref(details.phone)}
                    className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <Phone
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground/50"
                    />
                    <span dir="ltr">{details.phone}</span>
                  </a>
                </li>
              ) : null}
              {details.email ? (
                <li>
                  <a
                    href={`mailto:${details.email}`}
                    className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <Mail
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground/50"
                    />
                    <span dir="ltr">{details.email}</span>
                  </a>
                </li>
              ) : null}
              {details.address ? (
                <li className="flex gap-2 text-sm leading-6 text-muted-foreground">
                  <MapPin
                    aria-hidden="true"
                    className="mt-1 size-3.5 shrink-0 text-muted-foreground/50"
                  />
                  <span dir="auto" className="max-w-[16rem]">
                    {details.address}
                  </span>
                </li>
              ) : null}
            </ul>
            <Link
              href={localizeHref(locale, "/contact-us")}
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {t.contactCta}
              <ArrowRight
                aria-hidden="true"
                className="size-3.5 rtl:-scale-x-100"
              />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] tracking-[0.11em] text-muted-foreground/80 uppercase">
            {t.copyright.replace("{year}", String(year))}
          </p>
          <p className="font-mono text-[10px] tracking-[0.11em] text-muted-foreground/65 uppercase">
            {t.builtFor}
          </p>
        </div>
      </SiteContainer>
    </footer>
  )
}

export { SiteFooter }

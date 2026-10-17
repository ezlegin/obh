import { ArrowRight, ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { SiteContainer } from "@/components/site-container"
import { Logo } from "@/components/logo"
import { footerNavigation, services } from "@/lib/site"

function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-[#050505]">
      <SiteContainer>
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.65fr_0.95fr_0.6fr] lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="OBH home"
              className="inline-block rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Logo className="h-7" />
            </Link>
            <p className="mt-6 max-w-xs text-sm leading-6 text-muted-foreground">
              An IT corporation building a shared financial foundation for its
              portfolio of digital services.
            </p>
            <p className="mt-8 font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70 uppercase">
              Technology / Finance / Ownership
            </p>
          </div>

          <div>
            <p className="eyebrow">Navigate</p>
            <ul className="mt-5 space-y-3">
              {footerNavigation.map((item) => (
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
            <p className="eyebrow">Ecosystem</p>
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
                      className="size-3 text-muted-foreground/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow">Contact</p>
            <p className="mt-5 max-w-[13rem] text-sm leading-6 text-muted-foreground">
              Start with the service closest to your enquiry.
            </p>
            <Link
              href="/contact-us"
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              Contact OBH
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] tracking-[0.11em] text-muted-foreground/80 uppercase">
            © {year} OBH Corporation. All rights reserved.
          </p>
          <p className="font-mono text-[10px] tracking-[0.11em] text-muted-foreground/65 uppercase">
            Built for the OBH ecosystem
          </p>
        </div>
      </SiteContainer>
    </footer>
  )
}

export { SiteFooter }

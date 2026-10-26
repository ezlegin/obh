import {
  ArrowDownRight,
  ArrowRight,
  Code2,
  Handshake,
  LifeBuoy,
} from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { PageHero } from "@/components/page-hero"
import { SectionLabel } from "@/components/section-label"
import { ServiceDirectory } from "@/components/service-directory"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"

type ContactPageProps = {
  locale: Locale
  dictionary: Dictionary
}

const routeIcons = [LifeBuoy, Handshake, Code2] as const

function ContactPage({ locale, dictionary }: ContactPageProps) {
  const t = dictionary.contact

  return (
    <>
      <PageHero
        eyebrow={t.hero.label}
        title={
          <>
            {t.hero.titleLead}{" "}
            <span className="block text-muted-foreground/70">
              {t.hero.titleTail}
            </span>
          </>
        }
        description={t.hero.description}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="#service-directory"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t.hero.primaryCta}
            <ArrowDownRight
              aria-hidden="true"
              className="size-4 rtl:-scale-x-100"
            />
          </Link>
          <Link
            href={localizeHref(locale, "/about-us")}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t.hero.secondaryCta}
          </Link>
        </div>
      </PageHero>

      <section
        id="service-directory"
        className="scroll-mt-24 border-b border-border py-24 sm:py-32"
      >
        <SiteContainer>
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <div>
              <SectionLabel index="01">{t.directory.label}</SectionLabel>
              <h2 className="mt-6 max-w-2xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {t.directory.title}
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground">
                {t.directory.description}
              </p>
              <ServiceDirectory labels={dictionary.common} className="mt-10" />
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="space-y-3">
                {t.routes.map((route, index) => {
                  const Icon = routeIcons[index] ?? LifeBuoy

                  return (
                    <Card
                      key={route.title}
                      className="gap-4 rounded-2xl bg-card/40 p-5"
                    >
                      <CardHeader className="gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
                          <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <CardTitle>{route.title}</CardTitle>
                        <CardDescription>{route.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  )
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-transparent p-5">
                <p className="eyebrow">{t.corporate.label}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t.corporate.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Link
                    href={localizeHref(locale, "/about-us")}
                    className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {t.corporate.aboutLink}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 rtl:-scale-x-100"
                    />
                  </Link>
                  <Link
                    href={localizeHref(locale, "/terms")}
                    className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {t.corporate.termsLink}
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </SiteContainer>
      </section>

      <section className="py-24 sm:py-32">
        <SiteContainer>
          <div className="grid gap-10 border-t border-border pt-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">{t.closing.label}</p>
              <h2 className="mt-4 max-w-2xl text-3xl leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-4xl">
                {t.closing.title}
              </h2>
            </div>
            <Link
              href={localizeHref(locale, "/#services")}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t.closing.cta}
              <ArrowRight
                aria-hidden="true"
                className="size-4 rtl:-scale-x-100"
              />
            </Link>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

export { ContactPage }

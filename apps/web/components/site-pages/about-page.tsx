import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"

import { PageHero } from "@/components/page-hero"
import { SectionLabel } from "@/components/section-label"
import { ServiceDirectory } from "@/components/service-directory"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"

type AboutPageProps = {
  locale: Locale
  dictionary: Dictionary
}

function AboutPage({ locale, dictionary }: AboutPageProps) {
  const t = dictionary.about

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
            href="#corporation"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t.hero.primaryCta}
            <ArrowRight
              aria-hidden="true"
              className="size-4 rtl:-scale-x-100"
            />
          </Link>
          <Link
            href={localizeHref(locale, "/contact-us")}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            {t.hero.secondaryCta}
          </Link>
        </div>
      </PageHero>

      <section
        id="corporation"
        className="scroll-mt-24 border-b border-border py-24 sm:py-32"
      >
        <SiteContainer>
          <div className="grid gap-12 lg:grid-cols-[1fr_18rem] lg:gap-20">
            <div>
              <SectionLabel index="01">{t.corporation.label}</SectionLabel>
              <h2 className="mt-6 max-w-3xl text-3xl leading-[1.12] font-medium tracking-[-0.045em] text-balance sm:text-4xl lg:text-5xl">
                {t.corporation.title}
              </h2>

              <div className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
                {t.corporation.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-7 text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <blockquote className="mt-12 max-w-3xl border-l border-white/20 pl-6 text-xl leading-[1.4] font-medium tracking-[-0.025em] text-foreground sm:text-2xl rtl:border-r rtl:border-l-0 rtl:pr-6 rtl:pl-0">
                {t.corporation.quote}
              </blockquote>

              <div className="mt-10 flex flex-wrap gap-2">
                {t.corporation.badges.map((badge) => (
                  <Badge key={badge} variant="outline">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <p className="eyebrow">{t.corporation.glanceLabel}</p>
                <dl className="mt-6 divide-y divide-border">
                  {t.corporation.glance.map((item) => (
                    <div
                      key={item.term}
                      className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                    >
                      <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                        {item.term}
                      </dt>
                      <dd className="text-sm text-foreground">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <SectionLabel index="02">{t.building.label}</SectionLabel>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-20">
            <h2 className="max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
              {t.building.title}
            </h2>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border">
              {t.building.items.map((area) => (
                <article key={area.label} className="bg-background p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-medium tracking-[-0.015em]">
                      {area.label}
                    </h3>
                    <span aria-hidden="true" className="h-px w-8 bg-white/20" />
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                    {area.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
            <div>
              <SectionLabel index="03">{t.howWeWork.label}</SectionLabel>
              <h2 className="mt-6 max-w-md text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {t.howWeWork.title}
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
                {t.howWeWork.description}
              </p>
            </div>

            <div className="border-t border-border">
              {t.howWeWork.items.map((principle) => (
                <article
                  key={principle.number}
                  className="grid grid-cols-[2rem_1fr] gap-4 border-b border-border py-7 sm:grid-cols-[3rem_1fr] sm:gap-5 sm:py-8"
                >
                  <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70">
                    {principle.number}
                  </span>
                  <div>
                    <h3 className="text-lg font-medium tracking-[-0.02em]">
                      {principle.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                      {principle.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionLabel index="04">{t.ecosystem.label}</SectionLabel>
              <h2 className="mt-6 text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {t.ecosystem.title}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              {t.ecosystem.description}
            </p>
          </div>
          <ServiceDirectory labels={dictionary.common} className="mt-12" />
        </SiteContainer>
      </section>

      <section className="py-24 sm:py-32">
        <SiteContainer>
          <div className="flex flex-col items-start justify-between gap-8 border-t border-border pt-10 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">{t.next.label}</p>
              <h2 className="mt-4 max-w-2xl text-3xl leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-4xl">
                {t.next.title}
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={localizeHref(locale, "/#services")}
                className={buttonVariants({ size: "lg" })}
              >
                {t.next.primaryCta}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 rtl:-scale-x-100"
                />
              </Link>
              <Link
                href={localizeHref(locale, "/contact-us")}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                {t.next.secondaryCta}
              </Link>
            </div>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

export { AboutPage }

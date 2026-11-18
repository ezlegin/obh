import { ArrowDownRight, ArrowRight } from "lucide-react"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { HeroOrbit } from "@/components/hero-orbit"
import { SectionLabel } from "@/components/section-label"
import { ServiceDirectory } from "@/components/service-directory"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"

type HomePageProps = {
  locale: Locale
  dictionary: Dictionary
}

function HomePage({ locale, dictionary }: HomePageProps) {
  const t = dictionary.home

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border">
        <div aria-hidden="true" className="hero-grid absolute inset-0 -z-20" />
        <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10" />

        <SiteContainer className="relative grid min-h-[calc(100svh-4.5rem)] items-center gap-16 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-24">
          <div className="max-w-3xl">
            <div className="animate-rise flex flex-wrap items-center gap-3">
              <span className="eyebrow flex items-center gap-2 text-foreground">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-foreground/80"
                />
                {t.corporation}
              </span>
              <span aria-hidden="true" className="h-px w-6 bg-white/15" />
              <span className="eyebrow">{t.eyebrow}</span>
            </div>

            <h1 className="animate-rise mt-7 text-[clamp(3rem,7.6vw,6.8rem)] leading-[0.91] font-semibold tracking-[-0.06em] text-balance">
              {t.titleLead}{" "}
              <span className="mt-1 block text-muted-foreground/70">
                {t.titleTail}
              </span>
            </h1>

            <p className="animate-rise animate-delay-100 mt-8 max-w-xl text-base leading-8 text-pretty text-muted-foreground sm:text-lg">
              {t.description}
            </p>

            <div className="animate-rise animate-delay-200 mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="#services"
                className={cn(buttonVariants({ size: "lg" }), "pe-5")}
              >
                {t.primaryCta}
                <ArrowDownRight
                  aria-hidden="true"
                  className="size-4 rtl:-scale-x-100"
                />
              </Link>
              <Link
                href={localizeHref(locale, "/about-us")}
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                {t.secondaryCta}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 rtl:-scale-x-100"
                />
              </Link>
            </div>

            <div className="animate-fade mt-14 flex max-w-lg flex-wrap gap-x-7 gap-y-3 border-t border-border pt-5">
              {t.highlights.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 font-mono text-[9px] tracking-[0.1em] text-muted-foreground/65 uppercase"
                >
                  <span
                    aria-hidden="true"
                    className="size-1 rounded-full bg-white/30"
                  />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-rise-slow animate-delay-200 lg:w-full lg:max-w-[33rem] lg:justify-self-end">
            <HeroOrbit labels={dictionary.orbit} />
          </div>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <SectionLabel index="01">{t.premise.label}</SectionLabel>
            </div>
            <div>
              <h2 className="max-w-4xl text-3xl leading-[1.12] font-medium tracking-[-0.045em] text-balance sm:text-4xl lg:text-5xl">
                {t.premise.title}
              </h2>

              <div className="mt-10 grid max-w-3xl gap-8 sm:grid-cols-2">
                {t.premise.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-7 text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap gap-2">
                {t.premise.badges.map((badge) => (
                  <Badge key={badge} variant="outline">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </SiteContainer>
      </section>

      <section
        id="services"
        className="scroll-mt-24 border-b border-border py-24 sm:py-32"
      >
        <SiteContainer>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionLabel index="02">{t.ecosystem.label}</SectionLabel>
              <h2 className="mt-6 max-w-2xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl lg:text-6xl">
                {t.ecosystem.titleLead}{" "}
                <span className="block text-muted-foreground/70">
                  {t.ecosystem.titleTail}
                </span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              {t.ecosystem.description}
            </p>
          </div>

          <ServiceDirectory
            labels={dictionary.common}
            size="large"
            className="mt-14"
          />
        </SiteContainer>
      </section>

      <section className="relative isolate overflow-hidden border-b border-border py-24 sm:py-32">
        <div
          aria-hidden="true"
          className="fine-grid absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_88%)] opacity-60"
        />
        <SiteContainer className="relative">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionLabel index="03">{t.platform.label}</SectionLabel>
              <h2 className="mt-6 max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {t.platform.title}
              </h2>
              <div className="mt-7">
                <Badge variant="warning">
                  <span
                    aria-hidden="true"
                    className="size-1 rounded-full bg-warning"
                  />
                  {t.platform.badge}
                </Badge>
              </div>
              <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
                {t.platform.description}
              </p>
            </div>

            <div className="border-y border-border">
              {t.platform.pillars.map((pillar) => (
                <article
                  key={pillar.number}
                  className="grid grid-cols-[2rem_1fr] gap-4 border-b border-border py-8 last:border-b-0 sm:grid-cols-[3rem_1fr] sm:gap-5 sm:py-10"
                >
                  <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70">
                    {pillar.number}
                  </span>
                  <div>
                    <h3 className="text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                      {pillar.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                      {pillar.description}
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
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <SectionLabel index="04">{t.principles.label}</SectionLabel>
              <h2 className="mt-6 max-w-md text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {t.principles.title}
              </h2>
            </div>

            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
              {t.principles.items.map((principle) => (
                <article
                  key={principle.title}
                  className="bg-background p-6 sm:p-7"
                >
                  <span
                    aria-hidden="true"
                    className="block h-px w-8 bg-white/25"
                  />
                  <h3 className="mt-6 text-base font-medium tracking-[-0.01em]">
                    {principle.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {principle.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </SiteContainer>
      </section>

      <section className="py-24 sm:py-32">
        <SiteContainer>
          <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-card/60 px-6 py-14 sm:px-12 lg:px-16 lg:py-20">
            <div
              aria-hidden="true"
              className="fine-grid absolute inset-0 -z-10 opacity-40"
            />
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="eyebrow">{t.closing.label}</p>
                <h2 className="mt-5 max-w-2xl text-3xl leading-[1.06] font-semibold tracking-[-0.045em] text-balance sm:text-4xl lg:text-5xl">
                  {t.closing.title}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={localizeHref(locale, "/contact-us")}
                  className={buttonVariants({ size: "lg" })}
                >
                  {t.closing.primaryCta}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 rtl:-scale-x-100"
                  />
                </Link>
                <Link
                  href={localizeHref(locale, "/about-us")}
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                  })}
                >
                  {t.closing.secondaryCta}
                </Link>
              </div>
            </div>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

export { HomePage }

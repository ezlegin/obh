import {
  ArrowDownRight,
  ArrowRight,
  Code2,
  Landmark,
  Megaphone,
  PenTool,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { HeroOrbit } from "@/components/hero-orbit"
import { SectionLabel } from "@/components/section-label"
import { ServiceDirectory } from "@/components/service-directory"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"
import { services } from "@/lib/site"
import { leadership, portraitSrc, team } from "@/lib/team"

const staff = [...leadership, ...team]
const homeTeam = staff.slice(0, 5)
const capabilityIcons = [Code2, PenTool, Megaphone, Landmark] as const

type HomePageProps = {
  locale: Locale
  dictionary: Dictionary
}

function formatCount(locale: Locale, value: number) {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    minimumIntegerDigits: 2,
  }).format(value)
}

function HomePage({ locale, dictionary }: HomePageProps) {
  const t = dictionary.home

  const stats = [
    { value: formatCount(locale, services.length), label: t.stats.services },
    { value: formatCount(locale, staff.length), label: t.stats.team },
    { value: formatCount(locale, 4), label: t.stats.disciplines },
    { value: formatCount(locale, 2), label: t.stats.languages },
  ]

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
                href="#ecosystem"
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
          </div>

          <div className="animate-rise-slow animate-delay-200 lg:w-full lg:max-w-[33rem] lg:justify-self-end">
            <HeroOrbit labels={dictionary.orbit} />
          </div>
        </SiteContainer>
      </section>

      <section aria-label={t.stats.label} className="border-b border-border">
        <SiteContainer>
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  "border-border py-8 sm:py-10",
                  index % 2 === 1 && "border-s ps-6 sm:ps-8",
                  index >= 2 && "border-t lg:border-t-0",
                  index === 2 && "lg:border-s lg:ps-8"
                )}
              >
                <dt className="eyebrow">{stat.label}</dt>
                <dd className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <SectionLabel index="01">{t.about.label}</SectionLabel>
            </div>
            <div>
              <h2 className="max-w-4xl text-3xl leading-[1.12] font-medium tracking-[-0.045em] text-balance sm:text-4xl lg:text-5xl">
                {t.about.title}
              </h2>

              <div className="mt-10 grid max-w-3xl gap-8 sm:grid-cols-2">
                {t.about.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-7 text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <Link
                href={localizeHref(locale, "/about-us")}
                className="mt-10 inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                {t.about.cta}
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 rtl:-scale-x-100"
                />
              </Link>
            </div>
          </div>
        </SiteContainer>
      </section>

      <section
        id="ecosystem"
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
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionLabel index="03">{t.capabilities.label}</SectionLabel>
              <h2 className="mt-6 max-w-2xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {t.capabilities.title}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              {t.capabilities.description}
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {t.capabilities.items.map((item, index) => {
              const Icon = capabilityIcons[index] ?? Code2

              return (
                <article
                  key={item.title}
                  className="flex flex-col bg-background p-7 sm:p-9"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-white/[0.03] text-foreground/80">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-8 text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                    {item.description}
                  </p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
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

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionLabel index="05">{t.team.label}</SectionLabel>
              <h2 className="mt-6 max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                {t.team.title}
              </h2>
            </div>
            <Link
              href={localizeHref(locale, "/team")}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "self-start sm:self-auto"
              )}
            >
              {t.team.cta}
              <ArrowRight
                aria-hidden="true"
                className="size-4 rtl:-scale-x-100"
              />
            </Link>
          </div>

          <ul className="-mx-4 mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0">
            {homeTeam.map((member) => (
              <li
                key={member.slug}
                className="group w-[42vw] shrink-0 snap-start sm:w-auto"
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-card">
                  <Image
                    src={portraitSrc(member)}
                    alt={member.name[locale]}
                    fill
                    sizes="(min-width: 640px) 15rem, 42vw"
                    className="object-cover object-top grayscale-[35%] transition duration-500 group-hover:scale-[1.02] group-hover:grayscale-0"
                  />
                </div>
                <h3 className="mt-4 text-base font-medium tracking-[-0.01em]">
                  {member.name[locale]}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {member.role[locale]}
                </p>
              </li>
            ))}
          </ul>
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
                <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
                  {t.closing.description}
                </p>
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
                  href={localizeHref(locale, "/team")}
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

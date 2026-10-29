import { ArrowLeft, Check } from "lucide-react"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SectionLabel } from "@/components/section-label"
import { ServiceDirectory } from "@/components/service-directory"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"
import { formatToman, planList } from "@/lib/plans"

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
            <p className="animate-rise eyebrow flex items-center gap-2 text-foreground">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-foreground/80"
              />
              {t.eyebrow}
            </p>

            <h1 className="animate-rise mt-7 text-[clamp(2.5rem,6.4vw,5.6rem)] font-semibold text-balance">
              {t.titleLead}{" "}
              <span className="mt-2 block text-muted-foreground/70">
                {t.titleTail}
              </span>
            </h1>

            <p className="animate-rise animate-delay-100 mt-8 max-w-xl text-base leading-9 text-pretty text-muted-foreground sm:text-lg">
              {t.description}
            </p>

            <div className="animate-rise animate-delay-200 mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="#plans"
                className={cn(buttonVariants({ size: "lg" }), "pe-5")}
              >
                {t.primaryCta}
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href={localizeHref(locale, "/contact-us")}
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                {t.secondaryCta}
              </Link>
            </div>

            <div className="animate-fade mt-14 flex max-w-lg flex-wrap gap-x-7 gap-y-3 border-t border-border pt-5">
              {t.highlights.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-xs text-muted-foreground/80"
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
            <div className="overflow-hidden rounded-2xl border border-border bg-card/60 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-white/15" />
                  <span className="size-2.5 rounded-full bg-white/15" />
                  <span className="size-2.5 rounded-full bg-white/15" />
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.hero.windowTitle}
                </span>
              </div>
              <ul className="space-y-4 p-6">
                {t.hero.lines.map((line, index) => (
                  <li
                    key={line}
                    className="flex items-center gap-3 text-sm text-foreground/90"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">
                      {index + 1}
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-6 py-4">
                <Badge variant="outline">{t.hero.status}</Badge>
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
              <SectionLabel index="۰۱">{t.services.label}</SectionLabel>
              <h2 className="mt-6 max-w-2xl text-3xl font-semibold text-balance sm:text-4xl lg:text-5xl">
                {t.services.titleLead}{" "}
                <span className="block text-muted-foreground/70">
                  {t.services.titleTail}
                </span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              {t.services.description}
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {t.services.items.map((item) => (
              <article key={item.title} className="bg-background p-7 sm:p-9">
                <span className="text-xs text-muted-foreground/70">
                  {item.number}
                </span>
                <h3 className="mt-5 text-xl font-medium">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionLabel index="۰۲">{t.process.label}</SectionLabel>
              <h2 className="mt-6 max-w-md text-3xl font-semibold text-balance sm:text-4xl">
                {t.process.title}
              </h2>
            </div>
            <div className="border-y border-border">
              {t.process.steps.map((step) => (
                <article
                  key={step.number}
                  className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-border py-8 last:border-b-0 sm:py-10"
                >
                  <span className="text-xs text-muted-foreground/70">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-xl font-medium">{step.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SiteContainer>
      </section>

      <section
        id="plans"
        className="relative isolate scroll-mt-24 overflow-hidden border-b border-border py-24 sm:py-32"
      >
        <div
          aria-hidden="true"
          className="fine-grid absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_88%)] opacity-60"
        />
        <SiteContainer className="relative">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionLabel index="۰۳">{t.plans.label}</SectionLabel>
              <h2 className="mt-6 max-w-2xl text-3xl font-semibold text-balance sm:text-4xl lg:text-5xl">
                {t.plans.titleLead}{" "}
                <span className="block text-muted-foreground/70">
                  {t.plans.titleTail}
                </span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              {t.plans.description}
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {planList.map((plan) => (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border border-border bg-card/60 p-7 sm:p-8",
                  plan.highlighted && "border-foreground/40 bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-semibold">{plan.name}</h3>
                  {plan.highlighted ? (
                    <Badge variant="outline">{t.plans.popular}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
                  {plan.tagline}
                </p>

                <p className="mt-6 text-3xl font-semibold">
                  {formatToman(plan.price)}
                </p>

                <dl className="mt-5 space-y-2 border-y border-border py-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t.plans.deliveryLabel}
                    </dt>
                    <dd>{plan.deliveryDays}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t.plans.supportLabel}
                    </dt>
                    <dd>{plan.support}</dd>
                  </div>
                </dl>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm leading-6 text-foreground/90"
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/checkout?plan=${plan.id}`}
                  className={cn(
                    buttonVariants({
                      variant: plan.highlighted ? "default" : "outline",
                      size: "lg",
                    }),
                    "mt-8 w-full"
                  )}
                >
                  {t.plans.cta} {plan.name}
                </Link>
              </article>
            ))}
          </div>

          <p className="mt-8 text-sm leading-7 text-muted-foreground">
            {t.plans.note}
          </p>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <SectionLabel index="۰۴">{t.portfolio.label}</SectionLabel>
              <h2 className="mt-6 max-w-md text-3xl font-semibold text-balance sm:text-4xl">
                {t.portfolio.title}
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
                {t.portfolio.description}
              </p>
            </div>
            <ServiceDirectory labels={dictionary.common} />
          </div>
        </SiteContainer>
      </section>

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <SectionLabel index="۰۵">{t.faq.label}</SectionLabel>
              <h2 className="mt-6 max-w-md text-3xl font-semibold text-balance sm:text-4xl">
                {t.faq.title}
              </h2>
            </div>
            <div className="border-t border-border">
              {t.faq.items.map((item) => (
                <details
                  key={item.question}
                  className="group border-b border-border py-5"
                >
                  <summary className="cursor-pointer list-none text-base font-medium marker:hidden focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none">
                    {item.question}
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-8 text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
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
                <h2 className="mt-5 max-w-2xl text-2xl font-semibold text-balance sm:text-3xl lg:text-4xl">
                  {t.closing.title}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={localizeHref(locale, "/contact-us")}
                  className={buttonVariants({ size: "lg" })}
                >
                  {t.closing.primaryCta}
                </Link>
                <Link
                  href="#plans"
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

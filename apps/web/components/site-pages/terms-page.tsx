import Link from "next/link"

import { PageHero } from "@/components/page-hero"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"

type TermsPageProps = {
  locale: Locale
  dictionary: Dictionary
}

function TermsPage({ locale, dictionary }: TermsPageProps) {
  const t = dictionary.terms

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
      />

      <section className="py-20 sm:py-28">
        <SiteContainer>
          <div className="grid gap-14 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <p className="eyebrow">{t.tocLabel}</p>
              <nav aria-label={t.tocAria} className="mt-5">
                <ol className="space-y-2.5 border-l border-border pl-4 rtl:border-r rtl:border-l-0 rtl:pr-4 rtl:pl-0">
                  {t.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="text-[13px] leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <p className="mt-8 border-t border-border pt-5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                {t.lastUpdatedLabel}
                <span className="mt-1 block text-muted-foreground">
                  {t.lastUpdatedValue}
                </span>
              </p>
            </aside>

            <div className="max-w-3xl">
              <div className="border-b border-border pb-8">
                <p className="text-sm leading-7 text-muted-foreground">
                  {t.intro}
                </p>
              </div>

              <div className="divide-y divide-border">
                {t.sections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-28 py-9 first:pt-8"
                  >
                    <h2 className="text-xl font-medium tracking-[-0.02em] sm:text-2xl">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-4">
                      {section.body.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-sm leading-7 text-muted-foreground"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6">
                <p className="eyebrow">{t.questions.label}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t.questions.description}
                </p>
                <Link
                  href={localizeHref(locale, "/contact-us")}
                  className="mt-4 inline-flex text-sm text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  {t.questions.cta}
                </Link>
              </div>
            </div>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

export { TermsPage }

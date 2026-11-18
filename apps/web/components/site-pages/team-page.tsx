import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import { buttonVariants } from "@workspace/ui/components/button"

import { PageHero } from "@/components/page-hero"
import { SectionLabel } from "@/components/section-label"
import { SiteContainer } from "@/components/site-container"
import type { Dictionary } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { localizeHref } from "@/lib/i18n/links"
import { leadership, portraitSrc, team } from "@/lib/team"

const staff = [...leadership, ...team]

type TeamPageProps = {
  locale: Locale
  dictionary: Dictionary
}

function TeamPage({ locale, dictionary }: TeamPageProps) {
  const t = dictionary.team

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

      <section className="border-b border-border py-24 sm:py-32">
        <SiteContainer>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <SectionLabel index="01">{t.members.label}</SectionLabel>
              <h2 className="mt-6 max-w-2xl text-3xl leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-4xl lg:text-5xl">
                {t.members.title}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              {t.members.description}
            </p>
          </div>

          <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:grid-cols-3 lg:grid-cols-5">
            {staff.map((member, index) => (
              <li key={member.slug} className="group">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-card">
                  <Image
                    src={portraitSrc(member)}
                    alt={member.name[locale]}
                    fill
                    priority={index < 5}
                    sizes="(min-width: 1024px) 15rem, (min-width: 640px) 33vw, 50vw"
                    className="object-cover object-top grayscale-[35%] transition duration-500 group-hover:scale-[1.02] group-hover:grayscale-0"
                  />
                </div>
                <p className="eyebrow mt-4">{member.department[locale]}</p>
                <h3 className="mt-2 text-base font-medium tracking-[-0.01em] sm:text-lg">
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
                <h2 className="mt-5 max-w-2xl text-3xl leading-[1.06] font-semibold tracking-[-0.045em] text-balance sm:text-4xl">
                  {t.closing.title}
                </h2>
              </div>
              <Link
                href={localizeHref(locale, "/contact-us")}
                className={buttonVariants({ size: "lg" })}
              >
                {t.closing.cta}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 rtl:-scale-x-100"
                />
              </Link>
            </div>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

export { TeamPage }

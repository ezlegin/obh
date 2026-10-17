import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"

import { PageHero } from "@/components/page-hero"
import { SectionLabel } from "@/components/section-label"
import { ServiceDirectory } from "@/components/service-directory"
import { SiteContainer } from "@/components/site-container"

export const metadata: Metadata = {
  title: "About",
  description:
    "OBH Corporation is an IT corporation building a shared financial foundation for its portfolio of digital services.",
}

const platformAreas = [
  {
    label: "Payments",
    description:
      "One payment layer for the ecosystem: service authentication, payment initiation, verified provider results, and a complete transaction history.",
  },
  {
    label: "Financial operations",
    description:
      "Revenue, expenses, balances, and cash flow recorded as distinct financial facts, with the context needed to review them accurately.",
  },
  {
    label: "Ownership",
    description:
      "Shareholder records, historical ownership, profit calculations, and distributions designed to remain explainable over time.",
  },
] as const

const workingPrinciples = [
  {
    number: "01",
    title: "Make the boundary explicit.",
    description:
      "Payment state, accounting records, balances, and connected services are related — but never treated as the same thing.",
  },
  {
    number: "02",
    title: "Keep the record.",
    description:
      "Financial changes should be reversible through recorded adjustments, not erased from history.",
  },
  {
    number: "03",
    title: "Prefer the precise answer.",
    description:
      "Exact amounts, validated server-side operations, and careful rules matter more than a faster approximation.",
  },
  {
    number: "04",
    title: "Design for review.",
    description:
      "Every important calculation and status change should be visible, attributable, and open to inspection.",
  },
] as const

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About / OBH Corporation"
        title={
          <>
            Independent services.{" "}
            <span className="block text-muted-foreground/70">
              A shared discipline.
            </span>
          </>
        }
        description="OBH is an IT corporation behind a portfolio of digital services. Its next layer is a centralized financial platform for the entire group."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="#corporation"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Read the story
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href="/contact-us"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            Contact OBH
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
              <SectionLabel index="01">The corporation</SectionLabel>
              <h2 className="mt-6 max-w-3xl text-3xl leading-[1.12] font-medium tracking-[-0.045em] text-balance sm:text-4xl lg:text-5xl">
                A portfolio of products, held together by common standards.
              </h2>

              <div className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
                <p className="text-sm leading-7 text-muted-foreground">
                  OBH Corporation is an IT corporation with a portfolio of
                  digital services, each operating under its own domain and
                  identity. The group’s role is to provide the structure that
                  lets those services work together without losing their
                  independence.
                </p>
                <p className="text-sm leading-7 text-muted-foreground">
                  That structure is financial as well as operational. Payments,
                  accounting, and ownership have historically been handled close
                  to each service. OBH is consolidating that foundation into one
                  governed platform for the whole corporation.
                </p>
              </div>

              <blockquote className="mt-12 max-w-3xl border-l border-white/20 pl-6 text-xl leading-[1.4] font-medium tracking-[-0.025em] text-foreground sm:text-2xl">
                Independent products. Shared standards. One financial record.
              </blockquote>

              <div className="mt-10 flex flex-wrap gap-2">
                <Badge variant="outline">Technology</Badge>
                <Badge variant="outline">Digital services</Badge>
                <Badge variant="warning">Platform in development</Badge>
              </div>
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <p className="eyebrow">At a glance</p>
                <dl className="mt-6 divide-y divide-border">
                  {[
                    ["Corporation", "OBH Corporation"],
                    ["Focus", "IT and digital services"],
                    ["Ecosystem", "Six services"],
                    ["Platform", "In development"],
                  ].map(([term, value]) => (
                    <div
                      key={term}
                      className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                    >
                      <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                        {term}
                      </dt>
                      <dd className="text-sm text-foreground">{value}</dd>
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
          <SectionLabel index="02">What we’re building</SectionLabel>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-20">
            <h2 className="max-w-xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
              One system, with the right boundaries.
            </h2>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border">
              {platformAreas.map((area) => (
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
              <SectionLabel index="03">How we work</SectionLabel>
              <h2 className="mt-6 max-w-md text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                The record is the product.
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
                Good financial software is not defined by the number of features
                on screen. It is defined by whether the number on screen can be
                trusted.
              </p>
            </div>

            <div className="border-t border-border">
              {workingPrinciples.map((principle) => (
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
              <SectionLabel index="04">The ecosystem</SectionLabel>
              <h2 className="mt-6 text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                The services behind OBH.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Each service has its own identity and audience. Together they form
              the ecosystem this financial platform is designed to serve.
            </p>
          </div>
          <ServiceDirectory className="mt-12" />
        </SiteContainer>
      </section>

      <section className="py-24 sm:py-32">
        <SiteContainer>
          <div className="flex flex-col items-start justify-between gap-8 border-t border-border pt-10 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Next</p>
              <h2 className="mt-4 max-w-2xl text-3xl leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-4xl">
                Learn how the ecosystem is connected.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#services"
                className={buttonVariants({ size: "lg" })}
              >
                Explore the ecosystem
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/contact-us"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Contact OBH
              </Link>
            </div>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

import type { Metadata } from "next"
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

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach OBH through the service closest to your enquiry, or learn more about the corporation and its ecosystem.",
}

const contactRoutes = [
  {
    icon: LifeBuoy,
    title: "Product support",
    description:
      "For questions about a product, account, or order, contact the service you used directly.",
  },
  {
    icon: Handshake,
    title: "Partnerships",
    description:
      "For opportunities that involve more than one OBH service, begin with the service closest to the work.",
  },
  {
    icon: Code2,
    title: "Developers",
    description:
      "Payment SDK documentation will be published separately when the platform is ready for integrations.",
  },
] as const

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact / OBH Corporation"
        title={
          <>
            A direct line{" "}
            <span className="block text-muted-foreground/70">to OBH.</span>
          </>
        }
        description="Start with the service closest to your enquiry. Each OBH service is listed at its official domain."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="#service-directory"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Find a service
            <ArrowDownRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href="/about-us"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            About OBH
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
              <SectionLabel index="01">Service directory</SectionLabel>
              <h2 className="mt-6 max-w-2xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                Start with the service you know.
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground">
                The service directory is currently the most direct route to the
                right team. Open the relevant service below to continue on its
                official website.
              </p>
              <ServiceDirectory className="mt-10" />
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="space-y-3">
                {contactRoutes.map((route) => {
                  const Icon = route.icon

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
                <p className="eyebrow">Corporate information</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  For the corporation’s purpose and operating model, read the
                  About page. For website conditions, see the terms.
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Link
                    href="/about-us"
                    className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    About OBH
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                  <Link
                    href="/terms"
                    className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    Terms
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
              <p className="eyebrow">One ecosystem</p>
              <h2 className="mt-4 max-w-2xl text-3xl leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-4xl">
                Six services, each with its own front door.
              </h2>
            </div>
            <Link
              href="/#services"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              View the ecosystem
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

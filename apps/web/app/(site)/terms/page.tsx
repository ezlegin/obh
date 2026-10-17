import type { Metadata } from "next"
import Link from "next/link"

import { PageHero } from "@/components/page-hero"
import { SiteContainer } from "@/components/site-container"

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms that govern access to the OBH Corporation website and the information it provides.",
}

const termsSections = [
  {
    id: "acceptance",
    title: "1. Acceptance of these terms",
    body: [
      "These terms govern your access to and use of this website. By accessing or using the website, you agree to be bound by these terms. If you do not agree, please do not use the website.",
    ],
  },
  {
    id: "about",
    title: "2. About this website",
    body: [
      "This website is operated by OBH Corporation (“OBH”, “we”, “us”, or “our”). It introduces OBH and the services in its ecosystem and provides information about the group.",
    ],
  },
  {
    id: "permitted-use",
    title: "3. Permitted use",
    body: [
      "You may use this website for lawful purposes and in a way that does not interfere with its operation or the use of others. You must not attempt to gain unauthorised access to any part of the website or its supporting systems.",
      "You are responsible for the equipment, software, and connectivity you use to access the website.",
    ],
  },
  {
    id: "services",
    title: "4. Services and external links",
    body: [
      "The website links to independent OBH services and may link to other third-party sites. Those services and sites may be governed by their own terms and policies.",
      "A link does not mean that OBH controls or endorses all content on the destination. You should review the applicable terms before using another service.",
    ],
  },
  {
    id: "payments",
    title: "5. Payments and financial information",
    body: [
      "This website is informational. It does not process payments, hold funds, or provide financial, investment, accounting, or legal advice.",
      "The OBH payment platform is under development. When payment services become available, separate integration agreements, provider terms, and operational rules will apply. No statement on this website should be treated as a promise that a particular payment method, provider, or financial feature is currently available.",
    ],
  },
  {
    id: "intellectual-property",
    title: "6. Intellectual property",
    body: [
      "The content, design, and marks on this website, including the OBH name and logo, are owned by or licensed to OBH Corporation. You may view the website and share links to it for personal or internal business reference.",
      "You may not reproduce, modify, distribute, or use OBH marks in a way that suggests endorsement or affiliation without prior written permission.",
    ],
  },
  {
    id: "accuracy",
    title: "7. Accuracy and availability",
    body: [
      "We aim to keep the information on this website accurate and current, but it may change as the corporation and its platform develop. The website is provided on an “as available” basis, and we do not guarantee uninterrupted access or that every statement will remain complete at all times.",
    ],
  },
  {
    id: "liability",
    title: "8. Limitation of liability",
    body: [
      "To the fullest extent permitted by applicable law, OBH will not be liable for indirect, incidental, special, or consequential loss arising from your use of, or inability to use, this website.",
      "Nothing in these terms excludes liability that cannot lawfully be excluded.",
    ],
  },
  {
    id: "changes",
    title: "9. Changes to these terms",
    body: [
      "We may update these terms as the website or the OBH platform develops. The current version will be posted on this page with its last-updated date. Continued use of the website after a change means you accept the updated terms.",
    ],
  },
  {
    id: "contact",
    title: "10. Contact",
    body: [
      "For questions about these terms, use the contact information on our contact page.",
    ],
  },
] as const

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal / Terms"
        title={
          <>
            Terms of use.{" "}
            <span className="block text-muted-foreground/70">
              The ground rules.
            </span>
          </>
        }
        description="The conditions that govern access to this website. These website terms are separate from any future service, integration, or payment agreement."
      />

      <section className="py-20 sm:py-28">
        <SiteContainer>
          <div className="grid gap-14 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <p className="eyebrow">On this page</p>
              <nav aria-label="Terms sections" className="mt-5">
                <ol className="space-y-2.5 border-l border-border pl-4">
                  {termsSections.map((section) => (
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
                Last updated
                <span className="mt-1 block text-muted-foreground">
                  October 2026
                </span>
              </p>
            </aside>

            <div className="max-w-3xl">
              <div className="border-b border-border pb-8">
                <p className="text-sm leading-7 text-muted-foreground">
                  Please read these terms carefully. They describe the basis on
                  which this website is made available. Separate terms will
                  apply to the OBH payment platform and to individual services
                  when those services are used.
                </p>
              </div>

              <div className="divide-y divide-border">
                {termsSections.map((section) => (
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
                <p className="eyebrow">Questions</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  For questions about these terms, or to find the right service
                  for an enquiry, visit the contact page.
                </p>
                <Link
                  href="/contact-us"
                  className="mt-4 inline-flex text-sm text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  Contact OBH
                </Link>
              </div>
            </div>
          </div>
        </SiteContainer>
      </section>
    </>
  )
}

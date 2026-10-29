import type { Metadata } from "next"

import "./docs.css"

import { DocsFooter } from "@/components/docs/docs-footer"
import { DocsHeader } from "@/components/docs/docs-header"
import { DocsSidebar } from "@/components/docs/docs-sidebar"
import { docsSiteUrl } from "@/lib/docs/site"

const siteUrl = docsSiteUrl

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OBH Payments SDK — Documentation",
    template: "%s — OBH Payments SDK",
  },
  description:
    "Documentation for @obhco/payments, the server-side TypeScript SDK for creating and verifying OBH payments.",
  applicationName: "OBH Payments SDK",
  category: "technology",
  keywords: [
    "OBH",
    "payments",
    "SDK",
    "TypeScript",
    "payment API",
    "idempotency",
    "webhooks",
  ],
  icons: {
    icon: [{ url: "/obh-logo.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "OBH Payments SDK — Documentation",
    description:
      "Create payments, verify status, and handle webhooks with the server-side OBH payments SDK.",
    siteName: "OBH Payments SDK",
    locale: "en",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OBH Payments SDK — Documentation",
    description:
      "Create payments, verify status, and handle webhooks with the server-side OBH payments SDK.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

// Nested under the site's root layout, which provides <html>, <body>, the
// Inter font and the skip link.
export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <DocsHeader />
      <div className="docs-shell flex gap-10">
        <DocsSidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 pt-8 outline-none lg:pl-1"
        >
          <aside
            role="note"
            className="mb-8 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-6"
          >
            <strong className="font-medium">
              The hosted OBH payment API has been retired.
            </strong>{" "}
            OBH no longer processes payments or hosts gateways. Services now
            take payments with <code>@obhco/pay</code> using their own gateway
            terminal, and report finances to OBH. The pages below describe the
            old <code>@obhco/payments</code> SDK and are kept for reference
            only; see the <code>@obhco/pay</code> README for current
            instructions.
          </aside>
          {children}
          <DocsFooter />
        </main>
      </div>
    </>
  )
}

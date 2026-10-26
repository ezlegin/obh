import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"

import "@workspace/ui/globals.css"
import "./docs.css"

import { DocsFooter } from "@/components/docs-footer"
import { DocsHeader } from "@/components/docs-header"
import { DocsSidebar } from "@/components/docs-sidebar"

// Self-hosted so the documentation builds and renders offline.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
})

const siteUrl =
  process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3200"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OBH Payments SDK — Documentation",
    template: "%s — OBH Payments SDK",
  },
  description:
    "Documentation for @obh/payments, the server-side TypeScript SDK for creating and verifying OBH payments.",
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

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080808",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`dark ${inter.variable}`}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <DocsHeader />
        <div className="docs-shell flex gap-10">
          <DocsSidebar />
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 pt-8 outline-none lg:pl-1"
          >
            {children}
            <DocsFooter />
          </main>
        </div>
      </body>
    </html>
  )
}

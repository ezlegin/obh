import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "@workspace/ui/globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "OBH Corporation — Financial infrastructure",
    template: "%s — OBH Corporation",
  },
  description:
    "OBH is an IT corporation building a centralized financial platform for payments, accounting, and ownership across its portfolio of digital services.",
  applicationName: "OBH",
  category: "technology",
  icons: {
    icon: [{ url: "/obh-logo.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "OBH Corporation — Financial infrastructure",
    description:
      "A centralized financial layer for the OBH ecosystem: payments, accounting, and ownership.",
    siteName: "OBH Corporation",
    locale: "en",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OBH Corporation — Financial infrastructure",
    description:
      "A centralized financial layer for the OBH ecosystem: payments, accounting, and ownership.",
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
        {children}
      </body>
    </html>
  )
}

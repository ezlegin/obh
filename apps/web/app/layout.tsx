import type { Metadata, Viewport } from "next"
import { Inter, Vazirmatn } from "next/font/google"

import "@workspace/ui/globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "OBH Corporation — Technology company",
    template: "%s — OBH Corporation",
  },
  description:
    "OBH Corporation is a technology company that designs, builds, and operates a group of digital services, with one team and a shared foundation behind them.",
  applicationName: "OBH",
  category: "technology",
  icons: {
    icon: [{ url: "/obh-logo.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "OBH Corporation — Technology company",
    description:
      "The official website of OBH Corporation, a technology company building and running a group of digital services.",
    siteName: "OBH Corporation",
    locale: "en",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OBH Corporation — Technology company",
    description:
      "The official website of OBH Corporation, a technology company building and running a group of digital services.",
  },
  alternates: {
    languages: { en: "/", fa: "/fa" },
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
      className={`dark ${inter.variable} ${vazirmatn.variable}`}
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

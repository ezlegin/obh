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
    default: "OBH — طراحی و توسعه وب‌سایت",
    template: "%s — OBH",
  },
  description:
    "OBH یک استودیوی طراحی و برنامه‌نویسی وب‌سایت است: وب‌سایت شرکتی، فروشگاه اینترنتی و اپلیکیشن وب با سه پلن استارتر، پرو و اولترا.",
  applicationName: "OBH",
  category: "technology",
  icons: {
    icon: [{ url: "/obh-logo.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "OBH — طراحی و توسعه وب‌سایت",
    description:
      "طراحی و برنامه‌نویسی وب‌سایت شرکتی، فروشگاه اینترنتی و اپلیکیشن وب.",
    siteName: "OBH",
    locale: "fa_IR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OBH — طراحی و توسعه وب‌سایت",
    description:
      "طراحی و برنامه‌نویسی وب‌سایت شرکتی، فروشگاه اینترنتی و اپلیکیشن وب.",
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

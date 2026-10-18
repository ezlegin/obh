import type { Metadata } from "next"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import Link from "next/link"

import { LoginForm } from "@/components/auth/login-form"
import { Logo } from "@/components/logo"
import { getSafeAdminPath } from "@/lib/auth/redirects"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Authorized manager access to the OBH administration platform.",
  robots: {
    index: false,
    follow: false,
  },
}

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const rawCallbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl
  const callbackUrl = getSafeAdminPath(rawCallbackUrl)

  return (
    <main
      id="main-content"
      className="relative isolate min-h-dvh overflow-hidden bg-background"
    >
      <div aria-hidden="true" className="hero-grid absolute inset-0 -z-20" />
      <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10" />

      <div className="grid min-h-dvh lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden flex-col justify-between border-r border-border p-10 lg:flex xl:p-14">
          <div className="animate-rise">
            <Logo className="h-7" />
            <p className="mt-6 font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70 uppercase">
              Corporation / Admin
            </p>
          </div>

          <div className="animate-rise animate-delay-100 max-w-xl">
            <div className="flex size-11 items-center justify-center rounded-full border border-border bg-white/[0.03] text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <p className="mt-8 text-4xl leading-[1.03] font-semibold tracking-[-0.05em] text-balance xl:text-6xl">
              One financial view.
              <span className="mt-1 block text-muted-foreground/70">
                Restricted to responsible hands.
              </span>
            </p>
            <p className="mt-7 max-w-md text-sm leading-7 text-muted-foreground">
              OBH Admin is the private operating surface for payments,
              accounting, and ownership across the corporation.
            </p>
          </div>

          <div className="animate-fade flex items-center gap-6 border-t border-border pt-6">
            {["Payments", "Accounting", "Ownership"].map((label) => (
              <span
                key={label}
                className="flex items-center gap-2 font-mono text-[9px] tracking-[0.12em] text-muted-foreground/70 uppercase"
              >
                <span
                  aria-hidden="true"
                  className="size-1 rounded-full bg-white/30"
                />
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 sm:py-8 lg:px-14">
          <div className="flex items-center justify-between lg:hidden">
            <Logo className="h-[1.375rem]" />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              Website
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="animate-rise w-full max-w-[26rem]">
              <p className="eyebrow">Manager access</p>
              <h1 className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-5xl">
                Sign in to OBH.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                Use the manager credentials issued for this system. Access is
                checked on the server.
              </p>

              <div className="mt-8 rounded-2xl border border-border bg-card/60 p-5 shadow-soft sm:p-7">
                <LoginForm callbackUrl={callbackUrl} />
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 text-[11px] text-muted-foreground/70">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <ArrowLeft aria-hidden="true" className="size-3" />
                  Return to the website
                </Link>
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase">
                  No self-service reset
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-5 font-mono text-[9px] tracking-[0.12em] text-muted-foreground/55 uppercase">
            <span>OBH Corporation</span>
            <span>Private system</span>
          </div>
        </section>
      </div>
    </main>
  )
}

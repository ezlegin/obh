import type { ReactNode } from "react"

import { SiteContainer } from "@/components/site-container"

type PageHeroProps = {
  eyebrow: string
  title: ReactNode
  description: ReactNode
  children?: ReactNode
}

function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <header className="relative isolate overflow-hidden border-b border-border">
      <div aria-hidden="true" className="hero-grid absolute inset-0 -z-20" />
      <div aria-hidden="true" className="hero-glow absolute inset-0 -z-10" />
      <SiteContainer className="relative py-20 sm:py-28 lg:py-32">
        <div className="animate-rise max-w-4xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-6 text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.94] font-semibold tracking-[-0.055em] text-balance text-foreground">
            {title}
          </h1>
          <div className="mt-7 max-w-2xl text-base leading-8 text-pretty text-muted-foreground sm:text-lg">
            {description}
          </div>
          {children ? <div className="mt-9">{children}</div> : null}
        </div>
      </SiteContainer>
    </header>
  )
}

export { PageHero }

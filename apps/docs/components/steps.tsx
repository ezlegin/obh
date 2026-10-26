import type { ReactNode } from "react"

export function Steps({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 space-y-6">{children}</div>
}

export function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <div className="relative flex gap-4">
      <div className="relative flex flex-col items-center">
        <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[#101010] font-mono text-[0.68rem] text-foreground">
          {number}
        </span>
        <span aria-hidden="true" className="docs-step-line" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <h3 className="mt-0.5 mb-2 text-[0.95rem] font-semibold text-foreground">
          {title}
        </h3>
        <div className="text-[0.875rem] leading-relaxed text-[#b6b6ae] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </div>
  )
}

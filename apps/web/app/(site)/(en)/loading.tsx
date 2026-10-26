export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="site-container py-24 sm:py-32"
    >
      <span className="sr-only">Loading page</span>
      <div className="h-2.5 w-24 animate-pulse rounded-full bg-white/10" />
      <div className="mt-8 max-w-2xl space-y-4">
        <div className="h-12 w-full animate-pulse rounded-xl bg-white/[0.055] sm:h-16" />
        <div className="h-12 w-4/5 animate-pulse rounded-xl bg-white/[0.045] sm:h-16" />
      </div>
      <div className="mt-10 max-w-xl space-y-3">
        <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.045]" />
        <div className="h-3 w-11/12 animate-pulse rounded-full bg-white/[0.04]" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/[0.035]" />
      </div>
    </div>
  )
}

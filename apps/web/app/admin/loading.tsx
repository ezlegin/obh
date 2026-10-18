export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading admin page</span>

      <div className="space-y-4 border-b border-border pb-8">
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-white/10" />
        <div className="h-10 w-2/3 max-w-md animate-pulse rounded-xl bg-white/[0.055]" />
        <div className="h-3 w-full max-w-xl animate-pulse rounded-full bg-white/[0.04]" />
      </div>

      <div className="mt-8 h-20 animate-pulse rounded-2xl border border-border bg-white/[0.02]" />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl border border-border bg-white/[0.02]"
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,1fr)]">
        <div className="h-[25rem] animate-pulse rounded-2xl border border-border bg-white/[0.02]" />
        <div className="h-[25rem] animate-pulse rounded-2xl border border-border bg-white/[0.02]" />
      </div>
    </div>
  )
}

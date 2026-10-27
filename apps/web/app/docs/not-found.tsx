import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] max-w-xl flex-col justify-center py-16">
      <p className="font-mono text-[0.7rem] tracking-[0.16em] text-white/35 uppercase">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
        This page does not exist
      </h1>
      <p className="mt-3 text-[0.9rem] leading-relaxed text-muted-foreground">
        The documentation may have moved, or the link may be out of date. Try
        the introduction or use the search shortcut{" "}
        <kbd className="docs-kbd">⌘</kbd> <kbd className="docs-kbd">K</kbd>.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 text-[0.8rem]">
        <Link
          href="/docs"
          className="rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 text-foreground transition-colors hover:bg-white/[0.07]"
        >
          Introduction
        </Link>
        <Link
          href="/docs/quickstart"
          className="rounded-lg border border-white/12 px-3.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          Quickstart
        </Link>
        <Link
          href="/docs/api-reference"
          className="rounded-lg border border-white/12 px-3.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          API reference
        </Link>
      </div>
    </div>
  )
}

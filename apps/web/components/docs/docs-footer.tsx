import Link from "next/link"

export function DocsFooter() {
  return (
    <footer className="mt-16 flex flex-col gap-3 border-t border-white/[0.07] py-8 text-[0.72rem] text-white/35 sm:flex-row sm:items-center sm:justify-between">
      <p>
        OBH Payments SDK documentation ·{" "}
        <span className="font-mono">v0.1.0</span> · TEST environment only
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/docs/security"
          className="transition-colors hover:text-white/70"
        >
          Security
        </Link>
        <Link
          href="/docs/troubleshooting"
          className="transition-colors hover:text-white/70"
        >
          Troubleshooting
        </Link>
        <Link
          href="/docs/api-reference"
          className="transition-colors hover:text-white/70"
        >
          API reference
        </Link>
      </div>
    </footer>
  )
}

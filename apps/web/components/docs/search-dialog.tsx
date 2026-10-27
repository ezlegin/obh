"use client"

import { ArrowUpRight } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { searchIndex, type SearchEntry } from "@/lib/docs/search"

function matches(entry: SearchEntry, query: string) {
  const haystack =
    `${entry.page} ${entry.title} ${entry.description} ${entry.keywords}`.toLowerCase()

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

export function SearchDialog() {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(() => {
    if (!query.trim()) {
      return searchIndex.slice(0, 7)
    }

    return searchIndex.filter((entry) => matches(entry, query)).slice(0, 12)
  }, [query])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal()
      }

      setQuery("")
      setActiveIndex(0)
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  function go(entry: SearchEntry) {
    const target = entry.hash
      ? `${entry.pageHref}#${entry.hash}`
      : entry.pageHref

    setOpen(false)
    router.push(target)

    const hash = entry.hash

    if (hash) {
      window.setTimeout(() => {
        document
          .getElementById(hash)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 450)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search documentation"
        className="group flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-0 text-left text-[0.75rem] text-muted-foreground transition-colors hover:border-white/20 hover:bg-white/[0.04] sm:w-56 sm:justify-start sm:px-2.5 lg:w-64"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="size-3.5 text-white/35"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="hidden flex-1 truncate sm:block">
          Search documentation
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <kbd className="docs-kbd">⌘</kbd>
          <kbd className="docs-kbd">K</kbd>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Search documentation"
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault()
          setOpen(false)
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            setOpen(false)
          }
        }}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] max-w-none rounded-xl border border-white/12 bg-[#0c0c0c] p-0 text-foreground shadow-glow backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="size-4 shrink-0 text-white/35"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActiveIndex((index) =>
                  results.length === 0 ? 0 : (index + 1) % results.length
                )
              }

              if (event.key === "ArrowUp") {
                event.preventDefault()
                setActiveIndex((index) =>
                  results.length === 0
                    ? 0
                    : (index - 1 + results.length) % results.length
                )
              }

              if (event.key === "Enter") {
                const entry = results[activeIndex]

                if (entry) {
                  event.preventDefault()
                  go(entry)
                }
              }
            }}
            placeholder="Search guides, methods, errors…"
            aria-label="Search query"
            className="h-13 flex-1 bg-transparent text-[0.9rem] text-foreground outline-none placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[0.6rem] text-white/40 transition-colors hover:text-white/80"
          >
            ESC
          </button>
        </div>

        <div className="docs-scroll max-h-[min(26rem,60vh)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[0.8rem] text-muted-foreground">
              No matches for “{query}”.
            </p>
          ) : (
            <ul>
              {results.map((entry, index) => (
                <li key={`${entry.pageHref}-${entry.title}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(entry)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      index === activeIndex ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <span className="mt-0.5 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[0.58rem] whitespace-nowrap text-white/40">
                      {entry.page}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.82rem] font-medium text-foreground">
                        {entry.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.72rem] text-muted-foreground">
                        {entry.description}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="ml-auto size-3.5 shrink-0 text-white/20"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[0.65rem] text-white/30">
          <span className="flex items-center gap-1">
            <kbd className="docs-kbd">↑</kbd>
            <kbd className="docs-kbd">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="docs-kbd">↵</kbd> open
          </span>
          <span className="ml-auto">Searches titles and topics</span>
        </div>
      </dialog>
    </>
  )
}

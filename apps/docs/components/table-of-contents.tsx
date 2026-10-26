"use client"

import { useEffect, useState } from "react"

import type { DocSection } from "@/components/doc-page"

export function TableOfContents({ sections }: { sections: DocSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "")

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null)

    if (elements.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]

        if (visible) {
          setActiveId(visible.target.id)
        }
      },
      { rootMargin: "-88px 0px -68% 0px", threshold: 0 }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [sections])

  if (sections.length === 0) {
    return null
  }

  return (
    <nav aria-label="On this page" className="space-y-2">
      <p className="text-[0.63rem] font-medium tracking-[0.14em] text-white/35 uppercase">
        On this page
      </p>
      <ul className="space-y-0.5">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              data-active={activeId === section.id}
              className="toc-link"
              onClick={() => setActiveId(section.id)}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

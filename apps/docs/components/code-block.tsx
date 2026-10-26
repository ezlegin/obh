"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { highlight, toLines, type TokenType } from "@/lib/highlight"

const tokenClassNames: Record<TokenType, string | undefined> = {
  plain: undefined,
  keyword: "tok-keyword",
  string: "tok-string",
  comment: "tok-comment",
  number: "tok-number",
  function: "tok-function",
  type: "tok-type",
  property: "tok-property",
  literal: "tok-literal",
  operator: "tok-operator",
  punctuation: "tok-punctuation",
}

type CodeBlockProps = {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  className?: string
}

export function CodeBlock({
  code,
  language = "ts",
  filename,
  showLineNumbers = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const trimmed = code.replace(/^\n/, "").replace(/\n$/, "")
  const lines = toLines(highlight(trimmed, language))

  async function copy() {
    try {
      await navigator.clipboard.writeText(trimmed)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access can be denied; the code stays selectable.
    }
  }

  return (
    <figure className={cn("code-block not-prose", className)}>
      <div className="code-block-head">
        <figcaption className="flex min-w-0 items-center gap-2.5">
          {filename ? (
            <span className="truncate font-mono text-[0.7rem] text-muted-foreground">
              {filename}
            </span>
          ) : null}
          {filename ? (
            <span aria-hidden="true" className="text-[0.6rem] text-white/20">
              /
            </span>
          ) : null}
          <span className="font-mono text-[0.6rem] tracking-[0.12em] text-white/35 uppercase">
            {language}
          </span>
        </figcaption>

        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="flex h-6 items-center gap-1.5 rounded-md px-2 text-[0.65rem] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3" />
          ) : (
            <Copy aria-hidden="true" className="size-3" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      <div className="code-block-body docs-scroll">
        <pre className="m-0">
          <code>
            {lines.map((line, lineIndex) => (
              <span className="code-line" key={lineIndex}>
                {showLineNumbers ? (
                  <span aria-hidden="true" className="code-line-no">
                    {lineIndex + 1}
                  </span>
                ) : null}
                <span className="code-line-content">
                  {line.length === 0 ? "\u00A0" : null}
                  {line.map((token, tokenIndex) => (
                    <span
                      className={tokenClassNames[token.type]}
                      key={tokenIndex}
                    >
                      {token.value}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  )
}

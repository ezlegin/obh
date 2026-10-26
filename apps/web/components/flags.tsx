type FlagProps = {
  className?: string
}

/** United Kingdom flag, drawn inline to avoid an extra asset request. */
function EnglishFlag({ className }: FlagProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 40"
      className={className}
      focusable="false"
    >
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#ffffff" strokeWidth="9" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#c8102e" strokeWidth="5" />
      <path d="M30 0v40M0 20h60" stroke="#ffffff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="8" />
    </svg>
  )
}

/** Iran flag, drawn inline to avoid an extra asset request. */
function PersianFlag({ className }: FlagProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 40"
      className={className}
      focusable="false"
    >
      <rect width="60" height="40" fill="#ffffff" />
      <rect width="60" height="13.34" fill="#239f40" />
      <rect y="26.66" width="60" height="13.34" fill="#da0000" />
      <path
        d="M30 14.6c1.5 2 2.3 4 2.3 6 0 1.5-.7 2.8-2.3 3.9-1.6-1.1-2.3-2.4-2.3-3.9 0-2 .8-4 2.3-6Z"
        fill="#da0000"
      />
      <path
        d="M23.6 16.9c1.9 1 3.1 2.2 3.6 3.6.5 1.4.1 2.8-1 4.2-1.9-.5-3-1.4-3.4-2.8-.4-1.4-.1-3.1.8-5Zm12.8 0c.9 1.9 1.2 3.6.8 5-.4 1.4-1.5 2.3-3.4 2.8-1.1-1.4-1.5-2.8-1-4.2.5-1.4 1.7-2.6 3.6-3.6Z"
        fill="#da0000"
      />
    </svg>
  )
}

export { EnglishFlag, PersianFlag }

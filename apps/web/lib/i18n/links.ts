import type { Locale } from "@/lib/i18n/config"

/**
 * The public site is Persian-only and served from the root, so links are
 * returned unchanged. The helper stays so page components keep one place to
 * change if another language is ever added back. Old `/fa/...` URLs are
 * redirected in next.config.ts.
 */
export function localizeHref(_locale: Locale, href: string) {
  return href
}

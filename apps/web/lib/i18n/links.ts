import type { Locale } from "@/lib/i18n/config"

/**
 * The public site keeps English at the root (`/about-us`) and nests Persian
 * below `/fa` (`/fa/about-us`). Admin and auth routes are never localized.
 */
export function localizeHref(locale: Locale, href: string) {
  if (locale === "en") {
    return href
  }

  return href === "/" ? "/fa" : `/fa${href}`
}

function stripLocalePrefix(pathname: string) {
  if (pathname === "/fa" || pathname === "/fa/") {
    return "/"
  }

  if (pathname.startsWith("/fa/")) {
    return pathname.slice(3)
  }

  return pathname || "/"
}

/** Link to the same page in the other public-site language. */
export function localeSwitchHref(pathname: string, target: Locale) {
  const path = stripLocalePrefix(pathname)

  return target === "en" ? path : path === "/" ? "/fa" : `/fa${path}`
}

const LOCAL_ORIGIN = "http://obh.local"

/**
 * Only allow post-login redirects back into the protected admin area. This
 * prevents an open redirect through a user-controlled callbackUrl.
 */
export function getSafeAdminPath(input: string | undefined): string {
  if (!input) {
    return "/admin"
  }

  try {
    const url = new URL(input, LOCAL_ORIGIN)

    if (url.origin !== LOCAL_ORIGIN) {
      return "/admin"
    }

    if (url.pathname !== "/admin" && !url.pathname.startsWith("/admin/")) {
      return "/admin"
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/admin"
  }
}

export function getAppBaseUrl(fallbackOrigin?: string) {
  const configured =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    fallbackOrigin ??
    "http://localhost:3100"

  const url = new URL(configured)

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_URL must use http or https.")
  }

  return url.origin
}

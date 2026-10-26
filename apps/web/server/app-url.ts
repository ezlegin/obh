export function getAppBaseUrl(fallbackOrigin?: string) {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000"
  }

  const configured =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    fallbackOrigin ??
    "https://obhco.ir"

  const url = new URL(configured)

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_URL must use http or https.")
  }

  return url.origin
}

import { NextResponse } from "next/server"

import { auth } from "@/auth"

export default auth((request) => {
  if (!request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin)
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set("callbackUrl", callbackUrl)

    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/admin/:path*"],
}

import "server-only"

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getDb } from "@/lib/db/client"

export type AdminUser = {
  id: string
  name: string | null
  email: string
}

/**
 * Server-side guard for admin pages and future admin Server Actions.
 *
 * The proxy is only an optimistic redirect based on the signed JWT. This guard
 * verifies the manager still exists and is active in the database, and is the
 * check that privileged server operations must use.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  let user: {
    id: string
    name: string | null
    email: string
    isActive: boolean
  } | null = null

  try {
    user = await getDb().user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    })
  } catch (error) {
    console.error(
      "Admin session validation failed.",
      error instanceof Error ? error.name : "Unknown error"
    )
  }

  if (!user?.isActive) {
    redirect("/login")
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  }
}

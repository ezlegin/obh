"use server"

import { AuthError } from "next-auth"

import { signIn, signOut } from "@/auth"
import { getSafeAdminPath } from "@/lib/auth/redirects"
import { loginActionSchema, type LoginActionInput } from "@/lib/validation/auth"

export type LoginActionState = {
  error?: string
}

export async function loginAction(
  input: LoginActionInput
): Promise<LoginActionState> {
  const parsed = loginActionSchema.safeParse(input)

  if (!parsed.success) {
    return { error: "Enter a valid email and password." }
  }

  const redirectTo = getSafeAdminPath(parsed.data.callbackUrl)

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." }
    }

    throw error
  }

  return {}
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" })
}

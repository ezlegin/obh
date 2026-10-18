import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { getDb } from "@/lib/db/client"
import { verifyPassword } from "@/lib/auth/password"
import { loginSchema } from "@/lib/validation/auth"

// A valid bcrypt hash used only to equalize failed-login timing when the email
// does not exist. It never corresponds to an active credential.
const DUMMY_PASSWORD_HASH =
  "$2b$12$FZVaFBTVP1X1yMXutkMKWODcmOtfga.35OH5KoKzilH8pNLNP2tzi"

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials)

        if (!parsed.success) {
          return null
        }

        try {
          const db = getDb()
          const user = await db.user.findUnique({
            where: { email: parsed.data.email },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              isActive: true,
            },
          })

          const passwordMatches = await verifyPassword(
            parsed.data.password,
            user?.passwordHash ?? DUMMY_PASSWORD_HASH
          )

          if (!user?.isActive || !user.passwordHash || !passwordMatches) {
            return null
          }

          try {
            await db.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            })
          } catch (error) {
            console.error(
              "Authenticated manager but could not update lastLoginAt.",
              error instanceof Error ? error.name : "Unknown error"
            )
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        } catch (error) {
          console.error(
            "Credentials authorization failed.",
            error instanceof Error ? error.name : "Unknown error"
          )
          return null
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name
      }

      return token
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }

      return session
    },
  },
})

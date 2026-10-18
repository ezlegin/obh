import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

let prisma: PrismaClient | undefined

/**
 * Lazily creates the Prisma Client. Authentication pages must be able to render
 * before a database has been configured, so this module does not throw at
 * import time.
 */
export function getDb(): PrismaClient {
  if (prisma) {
    return prisma
  }

  if (globalForPrisma.prisma) {
    prisma = globalForPrisma.prisma
    return prisma
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Copy apps/web/.env.example to apps/web/.env and set a PostgreSQL connection string."
    )
  }

  const adapter = new PrismaPg({ connectionString })

  prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma
  }

  return prisma
}

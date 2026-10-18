import { config } from "dotenv"

config({ path: ".env.local" })
config()

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../lib/generated/prisma/client"
import { hashPassword, verifyPassword } from "../lib/auth/password"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is not configured.")
  process.exit(1)
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

try {
  await db.$queryRaw`select 1`
} catch (error) {
  console.error(
    "Database connection failed:",
    error instanceof Error ? error.message : "Unknown error"
  )
  await db.$disconnect()
  process.exit(1)
}

const users = await db.user.findMany({
  select: {
    email: true,
    isActive: true,
    passwordHash: true,
    createdAt: true,
  },
})

console.log(
  JSON.stringify(
    {
      userCount: users.length,
      users: users.map((user) => ({
        email: user.email,
        isActive: user.isActive,
        hasPasswordHash: Boolean(user.passwordHash),
        createdAt: user.createdAt.toISOString(),
      })),
    },
    null,
    2
  )
)

const targetEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
const targetPassword = process.env.ADMIN_PASSWORD ?? ""

if (!targetEmail || !targetPassword) {
  console.log("ADMIN_EMAIL/ADMIN_PASSWORD not both present; skipping check.")
  await db.$disconnect()
  process.exit(0)
}

const existing = await db.user.findUnique({
  where: { email: targetEmail },
  select: { id: true, email: true },
})

if (!existing) {
  const created = await db.user.create({
    data: {
      name: "OBH Manager",
      email: targetEmail,
      passwordHash: await hashPassword(targetPassword),
    },
    select: { email: true },
  })

  console.log(`Created manager: ${created.email}`)
} else {
  await db.user.update({
    where: { id: existing.id },
    data: {
      passwordHash: await hashPassword(targetPassword),
      isActive: true,
    },
  })

  console.log(`Updated password for existing manager: ${existing.email}`)
}

const check = await db.user.findUnique({
  where: { email: targetEmail },
  select: { passwordHash: true, isActive: true },
})

const valid = check?.passwordHash
  ? await verifyPassword(targetPassword, check.passwordHash)
  : false

console.log(
  JSON.stringify({
    email: targetEmail,
    isActive: check?.isActive ?? null,
    passwordVerifies: valid,
  })
)

await db.$disconnect()

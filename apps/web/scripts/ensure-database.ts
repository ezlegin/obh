import { config } from "dotenv"

config({ path: ".env.local" })
config()

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../lib/generated/prisma/client"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is not configured.")
  process.exit(1)
}

const url = new URL(connectionString)
const databaseName = url.pathname.replace(/^\//, "")
const adminUrl = new URL(url.toString())
adminUrl.pathname = "/postgres"
adminUrl.search = ""

if (!/^[a-z_][a-z0-9_]*$/i.test(databaseName)) {
  console.error("Unsafe database name in DATABASE_URL.")
  process.exit(1)
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: adminUrl.toString() }),
})

const existing = await db.$queryRaw<Array<{ count: bigint }>>`
  select count(*)::bigint as count from pg_database where datname = ${databaseName}
`

if (Number(existing[0]?.count ?? 0) === 0) {
  await db.$executeRawUnsafe(
    `CREATE DATABASE "${databaseName}" WITH ENCODING 'UTF8'`
  )
  console.log(`Created database: ${databaseName}`)
} else {
  console.log(`Database already exists: ${databaseName}`)
}

await db.$disconnect()

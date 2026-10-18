import "dotenv/config"

import { defineConfig } from "prisma/config"

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: "prisma/schema.prisma",
  // This project applies schema changes with `prisma db push`.
  // `prisma generate` can run without a database; commands that need a live
  // database (db push, studio) fail clearly until DATABASE_URL is configured.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})

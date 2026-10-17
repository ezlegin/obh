import "dotenv/config"

import { defineConfig } from "prisma/config"

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // `prisma generate` can run without a database. Commands that need a live
  // database (migrate, db push, studio) will fail clearly until DATABASE_URL is
  // configured.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})

import "dotenv/config"

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

import { PrismaPg } from "@prisma/adapter-pg"

import { hashPassword } from "../lib/auth/password"
import { PrismaClient } from "../lib/generated/prisma/client"
import { managerSchema } from "../lib/validation/auth"

function promptHidden(label: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error(
      "Cannot prompt for a password without a TTY. Set ADMIN_PASSWORD for non-interactive use."
    )
  }

  return new Promise((resolve, reject) => {
    stdout.write(label)

    let value = ""
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding("utf8")

    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off("data", onData)
    }

    const onData = (chunk: string | Buffer) => {
      const text = chunk.toString()

      if (text === "\u0003") {
        cleanup()
        stdout.write("\n")
        reject(new Error("Cancelled."))
        return
      }

      if (text === "\r" || text === "\n") {
        cleanup()
        stdout.write("\n")
        resolve(value)
        return
      }

      if (text === "\u007f" || text === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1)
          stdout.write("\b \b")
        }
        return
      }

      if (text === "\u001b") {
        return
      }

      value += text
      stdout.write("*")
    }

    stdin.on("data", onData)
  })
}

async function promptLine(label: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout })

  try {
    return await readline.question(label)
  } finally {
    readline.close()
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Add it to apps/web/.env before creating a manager."
    )
  }

  let email = process.env.ADMIN_EMAIL?.trim()

  if (!email) {
    email = (await promptLine("Manager email: ")).trim()
  }

  const name = process.env.ADMIN_NAME?.trim() || "OBH Manager"

  let password = process.env.ADMIN_PASSWORD

  if (!password) {
    password = await promptHidden("Password (12–72 characters): ")
    const confirmation = await promptHidden("Confirm password: ")

    if (password !== confirmation) {
      console.error("Passwords do not match.")
      process.exitCode = 1
      return
    }
  }

  const parsed = managerSchema.safeParse({ name, email, password })

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(`- ${issue.message}`)
    }
    process.exitCode = 1
    return
  }

  const adapter = new PrismaPg({ connectionString })
  const db = new PrismaClient({ adapter })

  try {
    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    })

    if (existing) {
      console.error("A manager with that email already exists.")
      process.exitCode = 1
      return
    }

    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: { email: true },
    })

    console.log(`Manager created: ${user.email}`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Manager creation failed."
  )
  process.exitCode = 1
})

// Works around a Next.js 16.4 Turbopack bug on Windows. Turbopack links
// external server packages (e.g. @prisma/client) into .next/dev/node_modules
// with junctions whose target is written as `\??\Global\C:\...`. Node does not
// recognise that form as a link, so on the next `next dev` start Next's own
// unlink fails with EPERM and the dev server exits.
//
// Removing each junction with a non-recursive rmdir deletes only the link,
// never the package it points to. Real directories are not empty, so rmdir
// leaves them alone. Never use a recursive delete here: it would follow the
// junction and delete files inside node_modules.
import { readdirSync, rmdirSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

if (process.platform !== "win32") {
  process.exit(0)
}

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".next",
  "dev",
  "node_modules"
)

function entries(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

let removed = 0

for (const entry of entries(root)) {
  const full = path.join(root, entry.name)
  const candidates = entry.name.startsWith("@")
    ? entries(full).map((child) => path.join(full, child.name))
    : [full]

  for (const candidate of candidates) {
    try {
      rmdirSync(candidate)
      removed += 1
    } catch {
      // Not a junction (or already gone); leave it.
    }
  }
}

if (removed > 0) {
  console.log(`Removed ${removed} stale Turbopack junction(s) from .next/dev.`)
}

import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { getDb } from "@/lib/db/client"
import {
  deleteCloudinaryDocument,
  getCloudinaryDocumentUrl,
  parseCloudinaryStorageKey,
  toCloudinaryStorageKey,
  uploadExpenseDocumentToCloudinary,
} from "@/server/accounting/cloudinary"
import { DomainError } from "@/server/errors"

export const MAX_EXPENSE_DOCUMENT_BYTES = 10 * 1024 * 1024

const allowedTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

type AllowedMimeType = keyof typeof allowedTypes

function getStorageRoot() {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.EXPENSE_DOCUMENT_DIR ??
      path.join(process.cwd(), "storage", "expense-documents")
  )
}

function getDocumentPath(storageKey: string) {
  const root = getStorageRoot()
  const resolved = path.resolve(root, storageKey)

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid document storage key.")
  }

  return resolved
}

function hasValidSignature(buffer: Buffer, mimeType: AllowedMimeType) {
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
  }

  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    )
  }

  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
}

export function validateExpenseDocumentFile(file: File) {
  if (!(file instanceof File) || file.size === 0) {
    throw new DomainError("DOCUMENT_EMPTY", "Select a non-empty document.")
  }

  if (file.size > MAX_EXPENSE_DOCUMENT_BYTES) {
    throw new DomainError(
      "DOCUMENT_TOO_LARGE",
      "Documents cannot exceed 10 MB."
    )
  }

  const mimeType = file.type as AllowedMimeType

  if (!(mimeType in allowedTypes)) {
    throw new DomainError(
      "DOCUMENT_TYPE_INVALID",
      "Only PDF, PNG, JPEG, and WebP documents are allowed."
    )
  }

  return mimeType
}

function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "document"
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255)
}

export async function attachExpenseDocument(
  actorId: string,
  expenseId: string,
  file: File
) {
  const db = getDb()
  const expense = await db.expense.findUnique({
    where: { id: expenseId },
    select: { id: true },
  })

  if (!expense) {
    throw new DomainError("EXPENSE_NOT_FOUND", "Expense was not found.")
  }

  const mimeType = validateExpenseDocumentFile(file)
  const buffer = Buffer.from(await file.arrayBuffer())

  if (!hasValidSignature(buffer, mimeType)) {
    throw new DomainError(
      "DOCUMENT_CONTENT_INVALID",
      "The document content does not match its file type."
    )
  }

  const extension = allowedTypes[mimeType]
  const checksumSha256 = createHash("sha256").update(buffer).digest("hex")
  const cloudinaryUpload = await uploadExpenseDocumentToCloudinary({
    buffer,
    fileName: cleanFileName(file.name),
    mimeType,
    expenseId,
    extension,
  })

  let storageKey: string
  let absolutePath: string | null = null

  if (cloudinaryUpload) {
    storageKey = toCloudinaryStorageKey(cloudinaryUpload.publicId)
  } else {
    storageKey = `${expenseId}/${randomUUID()}.${extension}`
    absolutePath = getDocumentPath(storageKey)

    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, buffer, { flag: "wx" })
  }

  try {
    return await db.$transaction(async (tx) => {
      const document = await tx.expenseDocument.create({
        data: {
          expenseId: expense.id,
          fileName: cleanFileName(file.name),
          storageKey,
          mimeType,
          byteSize: buffer.byteLength,
          checksumSha256,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId,
          action: "expense_document.uploaded",
          entityType: "ExpenseDocument",
          entityId: document.id,
          after: {
            expenseId: expense.id,
            fileName: document.fileName,
            mimeType: document.mimeType,
            byteSize: document.byteSize,
            storage: cloudinaryUpload ? "cloudinary" : "local",
          },
        },
      })

      return document
    })
  } catch (error) {
    if (cloudinaryUpload) {
      await deleteCloudinaryDocument(cloudinaryUpload.publicId).catch(
        (cleanupError: unknown) => {
          console.error(
            "Cloudinary document could not be removed after a failed record.",
            cleanupError instanceof Error ? cleanupError.name : "Unknown error"
          )
        }
      )
    } else if (absolutePath) {
      await unlink(absolutePath).catch(() => undefined)
    }

    throw error
  }
}

export async function deleteExpenseDocument(
  actorId: string,
  documentId: string
) {
  const db = getDb()
  const document = await db.expenseDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      expenseId: true,
      fileName: true,
      storageKey: true,
    },
  })

  if (!document) {
    throw new DomainError("DOCUMENT_NOT_FOUND", "Document was not found.")
  }

  await db.$transaction(async (tx) => {
    await tx.expenseDocument.delete({ where: { id: document.id } })

    await tx.auditLog.create({
      data: {
        actorId,
        action: "expense_document.deleted",
        entityType: "ExpenseDocument",
        entityId: document.id,
        before: {
          expenseId: document.expenseId,
          fileName: document.fileName,
        },
      },
    })
  })

  const cloudinaryPublicId = parseCloudinaryStorageKey(document.storageKey)

  if (cloudinaryPublicId) {
    await deleteCloudinaryDocument(cloudinaryPublicId).catch(
      (error: unknown) => {
        console.error(
          "Cloudinary expense document could not be removed.",
          error instanceof Error ? error.name : "Unknown error"
        )
      }
    )
    return
  }

  await unlink(getDocumentPath(document.storageKey)).catch((error: unknown) => {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      console.error(
        "Expense document file could not be removed.",
        error instanceof Error ? error.name : "Unknown error"
      )
    }
  })
}

export async function getExpenseDocumentForDownload(documentId: string) {
  const document = await getDb().expenseDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      storageKey: true,
      byteSize: true,
      expenseId: true,
    },
  })

  if (!document) {
    return null
  }

  const cloudinaryPublicId = parseCloudinaryStorageKey(document.storageKey)

  if (cloudinaryPublicId) {
    const url = getCloudinaryDocumentUrl(cloudinaryPublicId)

    if (!url) {
      throw new DomainError(
        "DOCUMENT_STORAGE_UNAVAILABLE",
        "Cloudinary is not configured."
      )
    }

    const response = await fetch(url, { cache: "no-store" })

    if (!response.ok) {
      throw new DomainError(
        "DOCUMENT_NOT_FOUND",
        "Document could not be retrieved."
      )
    }

    return {
      ...document,
      file: Buffer.from(await response.arrayBuffer()),
    }
  }

  const absolutePath = getDocumentPath(document.storageKey)
  const file = await readFile(
    /* turbopackIgnore: true */
    absolutePath
  )
  return { ...document, file }
}

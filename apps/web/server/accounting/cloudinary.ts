import "server-only"

import { createHash, randomUUID } from "node:crypto"

import { DomainError } from "@/server/errors"

const CLOUDINARY_STORAGE_PREFIX = "cloudinary:raw:"
const DEFAULT_EXPENSE_FOLDER = "obh/expense-documents"
const UPLOAD_TIMEOUT_MS = 30_000

type CloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
}

/**
 * Cloudinary is optional. Expense documents fall back to local disk storage
 * until all three credentials are configured (keys are expected to be added
 * to the deployment environment later).
 */
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()

  if (!cloudName || !apiKey || !apiSecret) {
    return null
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder:
      process.env.CLOUDINARY_EXPENSE_FOLDER?.trim() || DEFAULT_EXPENSE_FOLDER,
  }
}

export function isCloudinaryConfigured() {
  return getCloudinaryConfig() !== null
}

export function toCloudinaryStorageKey(publicId: string) {
  return `${CLOUDINARY_STORAGE_PREFIX}${publicId}`
}

export function parseCloudinaryStorageKey(storageKey: string) {
  return storageKey.startsWith(CLOUDINARY_STORAGE_PREFIX)
    ? storageKey.slice(CLOUDINARY_STORAGE_PREFIX.length)
    : null
}

function signParams(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&")

  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex")
}

async function postToCloudinary(
  path: string,
  formData: FormData,
  failureMessage: string
) {
  let response: Response

  try {
    response = await fetch(`https://api.cloudinary.com${path}`, {
      method: "POST",
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    })
  } catch {
    throw new DomainError(
      "DOCUMENT_STORAGE_UNAVAILABLE",
      "Cloudinary could not be reached. Please try again."
    )
  }

  if (!response.ok) {
    console.error("Cloudinary request failed.", response.statusText)
    throw new DomainError("DOCUMENT_STORAGE_FAILED", failureMessage)
  }

  return (await response.json()) as Record<string, unknown>
}

export async function uploadExpenseDocumentToCloudinary(input: {
  buffer: Buffer
  fileName: string
  mimeType: string
  expenseId: string
  extension: string
}) {
  const config = getCloudinaryConfig()

  if (!config) {
    return null
  }

  const timestamp = String(Math.floor(Date.now() / 1000))
  const publicId = `${config.folder}/${input.expenseId}/${randomUUID()}.${input.extension}`
  const params = { public_id: publicId, timestamp }
  const formData = new FormData()

  formData.set(
    "file",
    new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
    input.fileName
  )
  formData.set("api_key", config.apiKey)
  formData.set("timestamp", timestamp)
  formData.set("public_id", publicId)
  formData.set("signature", signParams(params, config.apiSecret))

  const payload = await postToCloudinary(
    `/v1_1/${config.cloudName}/raw/upload`,
    formData,
    "Cloudinary rejected the document upload."
  )

  const storedPublicId =
    typeof payload.public_id === "string" ? payload.public_id : publicId

  return { publicId: storedPublicId }
}

export function getCloudinaryDocumentUrl(publicId: string) {
  const config = getCloudinaryConfig()

  if (!config) {
    return null
  }

  const encodedPublicId = publicId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `https://res.cloudinary.com/${config.cloudName}/raw/upload/${encodedPublicId}`
}

export async function deleteCloudinaryDocument(publicId: string) {
  const config = getCloudinaryConfig()

  if (!config) {
    throw new DomainError(
      "DOCUMENT_STORAGE_UNAVAILABLE",
      "Cloudinary is not configured."
    )
  }

  const timestamp = String(Math.floor(Date.now() / 1000))
  const params = { public_id: publicId, timestamp }
  const formData = new FormData()

  formData.set("api_key", config.apiKey)
  formData.set("timestamp", timestamp)
  formData.set("public_id", publicId)
  formData.set("signature", signParams(params, config.apiSecret))

  await postToCloudinary(
    `/v1_1/${config.cloudName}/raw/destroy`,
    formData,
    "Cloudinary rejected the document deletion."
  )
}

import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto"

const VERSION = "v1"
const AAD = Buffer.from("obh-webhook-secret-v1", "utf8")

function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error("AUTH_SECRET is required to manage webhook secrets.")
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.alloc(0),
      Buffer.from("obh-webhook-secret-encryption-v1", "utf8"),
      32
    )
  )
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`
}

export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decryptWebhookSecret(value: string) {
  const [version, ivPart, tagPart, ciphertextPart] = value.split(".")

  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Invalid encrypted webhook secret.")
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64url")
  )
  decipher.setAAD(AAD)
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

const CREDENTIAL_AAD = Buffer.from("obh-service-credential-v1", "utf8")

function getCredentialEncryptionKey() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error("AUTH_SECRET is required to manage service credentials.")
  }

  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.alloc(0),
      Buffer.from("obh-service-credential-encryption-v1", "utf8"),
      32
    )
  )
}

export function encryptServiceCredentialSecret(presentedKey: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(
    "aes-256-gcm",
    getCredentialEncryptionKey(),
    iv
  )
  cipher.setAAD(CREDENTIAL_AAD)
  const ciphertext = Buffer.concat([
    cipher.update(presentedKey, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decryptServiceCredentialSecret(value: string): string | null {
  try {
    const [version, ivPart, tagPart, ciphertextPart] = value.split(".")

    if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
      return null
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getCredentialEncryptionKey(),
      Buffer.from(ivPart, "base64url")
    )
    decipher.setAAD(CREDENTIAL_AAD)
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export type CredentialEnvironment = "TEST" | "LIVE"

/**
 * Service credentials use a public key id plus a high-entropy secret. The
 * secret is shown once and only its SHA-256 digest is stored. Hashing a random
 * 256-bit secret is appropriate here; passwords must use a slow KDF instead.
 */
export function generateServiceCredential(
  environment: CredentialEnvironment = "TEST"
) {
  const keyId = `svc_${environment.toLowerCase()}_${randomBytes(8).toString("hex")}`
  const secret = randomBytes(32).toString("base64url")

  return {
    keyId,
    secret,
    presentedKey: `${keyId}.${secret}`,
    secretHash: hashServiceSecret(secret),
    environment,
  }
}

export function hashServiceSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex")
}

export function verifyServiceSecret(secret: string, expectedHash: string) {
  const actual = Buffer.from(hashServiceSecret(secret), "hex")
  const expected = Buffer.from(expectedHash, "hex")

  if (actual.length !== expected.length) {
    return false
  }

  return timingSafeEqual(actual, expected)
}

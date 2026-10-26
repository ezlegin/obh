import assert from "node:assert/strict"
import test from "node:test"

import {
  generateServiceCredential,
  hashServiceSecret,
  verifyServiceSecret,
} from "../server/payments/service-credentials"

test("generates a public key id and one-way secret hash", () => {
  const credential = generateServiceCredential()

  assert.match(credential.keyId, /^svc_[a-f0-9]{16}$/)
  assert.equal(credential.secret.length > 30, true)
  assert.equal(
    credential.presentedKey,
    `${credential.keyId}.${credential.secret}`
  )
  assert.equal(credential.secretHash, hashServiceSecret(credential.secret))
  assert.equal(credential.secretHash.includes(credential.secret), false)
})

test("verifies only the matching service secret", () => {
  const credential = generateServiceCredential("TEST")

  assert.equal(
    verifyServiceSecret(credential.secret, credential.secretHash),
    true
  )
  assert.equal(
    verifyServiceSecret("incorrect-secret", credential.secretHash),
    false
  )
})

test("two issued credentials never share key or secret material", () => {
  const first = generateServiceCredential("TEST")
  const second = generateServiceCredential("TEST")

  assert.notEqual(first.keyId, second.keyId)
  assert.notEqual(first.secret, second.secret)
  assert.notEqual(first.secretHash, second.secretHash)
})

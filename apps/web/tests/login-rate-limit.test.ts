import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"

import {
  clientIpFrom,
  loginRetryAfterSeconds,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginRateLimit,
} from "../lib/auth/rate-limit"

beforeEach(() => resetLoginRateLimit())

test("blocks an email after five failures and releases it after the window", () => {
  const now = 1_000_000
  for (let i = 0; i < 4; i++) recordLoginFailure("A@x.ir", "1.1.1.1", now)
  assert.equal(loginRetryAfterSeconds("a@x.ir", "2.2.2.2", now), 0)

  recordLoginFailure("a@x.ir", "1.1.1.1", now)
  assert.equal(loginRetryAfterSeconds("a@x.ir", "2.2.2.2", now), 900)
  assert.equal(loginRetryAfterSeconds("a@x.ir", "2.2.2.2", now + 900_000), 0)
})

test("blocks an IP after twenty failures across emails", () => {
  for (let i = 0; i < 20; i++) recordLoginFailure(`u${i}@x.ir`, "1.1.1.1")
  assert.ok(loginRetryAfterSeconds("new@x.ir", "1.1.1.1") > 0)
  assert.equal(loginRetryAfterSeconds("new@x.ir", "2.2.2.2"), 0)
})

test("a successful login clears the email counter", () => {
  for (let i = 0; i < 5; i++) recordLoginFailure("a@x.ir", null)
  recordLoginSuccess("a@x.ir")
  assert.equal(loginRetryAfterSeconds("a@x.ir", null), 0)
})

test("uses the proxy-appended X-Forwarded-For entry", () => {
  const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" })
  assert.equal(clientIpFrom(headers), "9.9.9.9")
  assert.equal(clientIpFrom(new Headers()), null)
})

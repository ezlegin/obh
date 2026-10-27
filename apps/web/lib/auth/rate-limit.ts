// Failed-login limiter. Production runs a single web container, so an
// in-process store is enough; a second instance would need a shared store.

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES_PER_EMAIL = 5
const MAX_FAILURES_PER_IP = 20
const MAX_TRACKED_KEYS = 10_000

type Entry = { failures: number; resetAt: number }

const store = new Map<string, Entry>()

function current(key: string, now: number) {
  const entry = store.get(key)

  if (entry && entry.resetAt <= now) {
    store.delete(key)
    return undefined
  }

  return entry
}

function prune(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key)
    }
  }

  // Under a flood of distinct keys, drop the oldest rather than grow forever.
  while (store.size > MAX_TRACKED_KEYS) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

function keysFor(email: string, ip: string | null) {
  const keys: Array<[string, number]> = [
    [`email:${email.toLowerCase()}`, MAX_FAILURES_PER_EMAIL],
  ]

  if (ip) {
    keys.push([`ip:${ip}`, MAX_FAILURES_PER_IP])
  }

  return keys
}

/** Seconds until another attempt is allowed, or 0 when it is allowed now. */
export function loginRetryAfterSeconds(
  email: string,
  ip: string | null,
  now = Date.now()
) {
  let retryAfter = 0

  for (const [key, max] of keysFor(email, ip)) {
    const entry = current(key, now)
    if (entry && entry.failures >= max) {
      retryAfter = Math.max(retryAfter, Math.ceil((entry.resetAt - now) / 1000))
    }
  }

  return retryAfter
}

export function recordLoginFailure(
  email: string,
  ip: string | null,
  now = Date.now()
) {
  if (store.size >= MAX_TRACKED_KEYS) {
    prune(now)
  }

  for (const [key] of keysFor(email, ip)) {
    const entry = current(key, now)
    if (entry) {
      entry.failures += 1
    } else {
      store.set(key, { failures: 1, resetAt: now + WINDOW_MS })
    }
  }
}

/** A successful login clears the account's counter, not the IP's. */
export function recordLoginSuccess(email: string) {
  store.delete(`email:${email.toLowerCase()}`)
}

export function resetLoginRateLimit() {
  store.clear()
}

/**
 * The client address as seen by the shared nginx-proxy, which appends the
 * peer address to X-Forwarded-For; earlier entries are client-supplied and
 * cannot be trusted, so the last one is used.
 */
export function clientIpFrom(headers: Headers | undefined) {
  const forwarded = headers?.get("x-forwarded-for")
  const last = forwarded?.split(",").at(-1)?.trim()

  return last || headers?.get("x-real-ip")?.trim() || null
}

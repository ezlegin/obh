import "server-only"

/**
 * Client for Kisan («داده‌پردازی کیسان», panel app.mizeonline.ir), the
 * trusted company (شرکت معتمد) that signs and sends the corporation's
 * electronic invoices to سامانه مودیان (memory id A49DW7). API v8.7.3:
 *
 *   token   POST /identity/api/servicetoken          valid 10 minutes
 *   send    POST /taxpayer/api/InvoiceExternalService_v6           (array)
 *   check   POST …_v6/InquiryByUniqueId                            (array)
 *   revoke  POST …_v6/InvoiceRevok                                 (array)
 *   service POST /taxpayer/api/CommodityServiceExternalService     (array)
 *
 * Off until KISAN_API_URL, KISAN_USERNAME, KISAN_PASSWORD and
 * KISAN_ECONOMIC_CODE are set. KISAN_RELAY_SECRET is sent as X-Relay-Secret
 * when the URL is an Iranian relay. Credentials never leave the server.
 */

export class KisanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KisanError"
  }
}

type KisanConfig = {
  url: string
  username: string
  password: string
  economicCode: string
  relaySecret: string
}

function readConfig(): KisanConfig | null {
  const url = process.env.KISAN_API_URL?.trim().replace(/\/+$/, "")
  const username = process.env.KISAN_USERNAME?.trim()
  const password = process.env.KISAN_PASSWORD
  const economicCode = process.env.KISAN_ECONOMIC_CODE?.trim()
  if (!url || !username || !password || !economicCode) return null
  return {
    url,
    username,
    password,
    economicCode,
    relaySecret: process.env.KISAN_RELAY_SECRET?.trim() ?? "",
  }
}

export function isKisanConfigured() {
  return readConfig() !== null
}

function requireConfig() {
  const config = readConfig()
  if (!config) throw new KisanError("Kisan is not configured (KISAN_* variables).")
  return config
}

type Body = { error?: unknown; message?: unknown; data?: unknown }

/** A field of Kisan's JSON whatever its casing (`trakingId`, `TrackingId`…). */
export function kisanField(row: unknown, ...names: string[]): unknown {
  if (!row || typeof row !== "object") return undefined
  const wanted = names.map((name) => name.toLowerCase())
  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(key.toLowerCase())) return value
  }
  return undefined
}

export function kisanText(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value)
}

async function post(config: KisanConfig, path: string, payload: unknown, token?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    accept: "application/json",
  }
  if (token) headers.authorization = `Bearer ${token}`
  if (config.relaySecret) headers["x-relay-secret"] = config.relaySecret

  let response: Response
  try {
    response = await fetch(`${config.url}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new KisanError("Kisan did not answer.")
  }
  const raw = await response.text()
  let body: Body
  try {
    body = JSON.parse(raw) as Body
  } catch {
    throw new KisanError(`Kisan sent an unreadable answer (HTTP ${response.status}).`)
  }
  if (response.status === 401 || response.status === 403) {
    throw new KisanError(`Kisan refused access (HTTP ${response.status}).`)
  }
  if (!response.ok) {
    throw new KisanError(kisanText(body.message) || `Kisan error (HTTP ${response.status}).`)
  }
  return body
}

let cachedToken: { value: string; until: number; key: string } | null = null

async function getToken(config: KisanConfig) {
  const key = `${config.url}|${config.username}|${config.economicCode}`
  if (cachedToken && cachedToken.key === key && Date.now() < cachedToken.until) {
    return cachedToken.value
  }
  const body = await post(config, "/identity/api/servicetoken", {
    UserName: config.username,
    Password: config.password,
    EconomicCode: config.economicCode,
  })
  const first = Array.isArray(body.data) ? body.data[0] : body.data
  const token = kisanText(kisanField(first, "token")).replace(/^Bearer\s*/i, "")
  if (body.error === true || !token) {
    throw new KisanError(kisanText(body.message) || "Signing in to Kisan failed.")
  }
  // Valid for 10 minutes; reuse for 8.
  cachedToken = { value: token, until: Date.now() + 8 * 60_000, key }
  return token
}

/** Calls an authenticated endpoint that takes and returns a list. */
async function postList(path: string, payload: unknown) {
  const config = requireConfig()
  const token = await getToken(config)
  const body = await post(config, path, payload, token)
  if (body.error === true && !Array.isArray(body.data)) {
    throw new KisanError(kisanText(body.message) || "Kisan reported an error.")
  }
  return Array.isArray(body.data) ? (body.data as unknown[]) : []
}

/** Sends invoices (or edits of ones Kisan holds); one result row per invoice. */
export function sendInvoices(invoices: unknown[]) {
  return postList("/taxpayer/api/InvoiceExternalService_v6", invoices)
}

/** Where each of these invoices (our unique ids) is. */
export function inquireInvoices(uniqueIds: string[]) {
  return postList("/taxpayer/api/InvoiceExternalService_v6/InquiryByUniqueId", uniqueIds)
}

/** Revokes (ابطال) invoices that reached the tax workspace. */
export function revokeInvoices(
  revocations: Array<{
    uniqueId: string
    invoiceNumber: string
    invoiceDate: string
    referenceTaxSerialNumber: string
    description: string
  }>
) {
  return postList("/taxpayer/api/InvoiceExternalService_v6/InvoiceRevok", revocations)
}

/** Registers a goods/service id at Kisan, with itself as our commodity code. */
export async function registerService(stuffId: string, title: string, vatPercent: number) {
  const rows = await postList("/taxpayer/api/CommodityServiceExternalService", [
    {
      stuffCode: stuffId,
      commodityCode: stuffId,
      title,
      defaultTaxPercent: vatPercent,
      defaultBaseUnitTypeCode: 1627,
    },
  ])
  const row = rows[0]
  const status = Number(kisanField(row, "status"))
  const message = kisanText(kisanField(row, "description"))
  // A second registration of the same code is refused; that is fine.
  const alreadyThere = /تکراری|موجود|exist/i.test(message)
  return { ok: status === 3 || alreadyThere, message }
}

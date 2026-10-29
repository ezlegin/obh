import "server-only"

import { getDb } from "@/lib/db/client"

type GatewayDefinition = {
  name: string
  description: string
  institution: string
}

/**
 * Gateways services can settle through. They are reference data for the
 * books only: OBH never talks to a bank. Each service owns its own terminal
 * and credentials (`@obhco/pay`), so every service gets its own settlement
 * account per gateway and environment.
 */
const GATEWAYS: Record<string, GatewayDefinition> = {
  sadad: {
    name: "Sadad (Bank Melli Iran)",
    description:
      "Sadad (Bank Melli Iran) Internet Payment Gateway. Full payment with Shetab bank cards.",
    institution: "Bank Melli Iran — Sadad IPG",
  },
  zarinpal: {
    name: "Zarinpal",
    description: "Zarinpal payment gateway. Full payment with Shetab bank cards.",
    institution: "Zarinpal",
  },
  mellat: {
    name: "Mellat (Behpardakht)",
    description:
      "Bank Mellat Behpardakht Internet Payment Gateway. Full payment with Shetab bank cards.",
    institution: "Bank Mellat — Behpardakht IPG",
  },
  digipay: {
    name: "Digipay (Installments / BNPL)",
    description:
      "Digipay Unified Payment Gateway. Installment (BNPL/credit), wallet, and card purchases.",
    institution: "Digipay UPG",
  },
}

export function isKnownGateway(code: string) {
  return code in GATEWAYS
}

/**
 * Returns the provider row and the settlement account that holds one
 * service's money at that gateway, creating both on first use.
 */
export async function ensureServiceProviderAccount(input: {
  serviceId: string
  serviceName: string
  gateway: string
  environment: "TEST" | "LIVE"
}) {
  const definition = GATEWAYS[input.gateway]
  const db = getDb()

  const provider = await db.paymentProvider.upsert({
    where: { code: input.gateway },
    update: { isActive: true },
    create: {
      code: input.gateway,
      name: definition?.name ?? input.gateway,
      description: definition?.description ?? null,
      isActive: true,
    },
  })

  const existing = await db.financialAccount.findFirst({
    where: {
      kind: "PROVIDER",
      providerId: provider.id,
      serviceId: input.serviceId,
      environment: input.environment,
    },
  })

  if (existing) {
    return { provider, account: existing }
  }

  const label = input.environment === "LIVE" ? "Live" : "Test"
  const account = await db.financialAccount.create({
    data: {
      name: `${provider.name} — ${input.serviceName} (${label})`,
      kind: "PROVIDER",
      providerId: provider.id,
      serviceId: input.serviceId,
      environment: input.environment,
      institution: definition?.institution ?? provider.name,
      currency: "IRR",
      openingBalance: 0,
      isActive: true,
      notes: `Settlement account for ${input.serviceName}'s own ${provider.name} terminal. Created automatically from the service's finance reports.`,
    },
  })

  return { provider, account }
}

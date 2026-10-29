import "server-only"

import { getDb } from "@/lib/db/client"
import {
  DIGIPAY_PROVIDER_CODE,
  DIGIPAY_PROVIDER_NAME,
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
  MELLAT_PROVIDER_CODE,
  MELLAT_PROVIDER_NAME,
  ZARINPAL_PROVIDER_CODE,
  ZARINPAL_PROVIDER_NAME,
} from "@/server/payments/providers/registry"
import type { ProviderEnvironmentValue } from "@/server/payments/providers/types"

type GatewayDefinition = {
  name: string
  description: string
  accounts: Record<
    ProviderEnvironmentValue,
    { name: string; institution: string; notes: string }
  >
}

const GATEWAYS: Record<string, GatewayDefinition> = {
  [SADAD_PROVIDER_CODE]: {
    name: SADAD_PROVIDER_NAME,
    description:
      "Official Sadad (Bank Melli Iran) Internet Payment Gateway (`sadad.shaparak.ir`). Full payment with Shetab bank cards.",
    accounts: {
      TEST: {
        name: "Sadad Test Settlement (Bank Melli)",
        institution: "Bank Melli Iran — Sadad IPG (Test)",
        notes:
          "Automatically provisioned Sadad test settlement account. Used for simulated or sandbox TEST payments.",
      },
      LIVE: {
        name: "Sadad Live Settlement (Bank Melli)",
        institution: "Bank Melli Iran — Sadad IPG",
        notes:
          "Automatically provisioned Sadad live acquiring account. Receives verified customer payments before bank settlement.",
      },
    },
  },
  [ZARINPAL_PROVIDER_CODE]: {
    name: ZARINPAL_PROVIDER_NAME,
    description:
      "Zarinpal payment gateway (`payment.zarinpal.com`). Full payment with Shetab bank cards.",
    accounts: {
      TEST: {
        name: "Zarinpal Test Settlement",
        institution: "Zarinpal (Test)",
        notes:
          "Automatically provisioned Zarinpal test settlement account. Used for simulated TEST payments.",
      },
      LIVE: {
        name: "Zarinpal Live Settlement",
        institution: "Zarinpal",
        notes:
          "Automatically provisioned Zarinpal live account. Receives verified customer payments before settlement.",
      },
    },
  },
  [MELLAT_PROVIDER_CODE]: {
    name: MELLAT_PROVIDER_NAME,
    description:
      "Bank Mellat Behpardakht Internet Payment Gateway (`bpm.shaparak.ir`). Full payment with Shetab bank cards.",
    accounts: {
      TEST: {
        name: "Mellat Test Settlement",
        institution: "Bank Mellat — Behpardakht IPG (Test)",
        notes:
          "Automatically provisioned Mellat test settlement account. Used for simulated TEST payments.",
      },
      LIVE: {
        name: "Mellat Live Settlement",
        institution: "Bank Mellat — Behpardakht IPG",
        notes:
          "Automatically provisioned Mellat live account. Receives verified and settled customer payments.",
      },
    },
  },
  [DIGIPAY_PROVIDER_CODE]: {
    name: DIGIPAY_PROVIDER_NAME,
    description:
      "Digipay Unified Payment Gateway (`mydigipay.com`). Installment (BNPL/credit), wallet, and card purchases.",
    accounts: {
      TEST: {
        name: "Digipay Test Settlement",
        institution: "Digipay UPG (Test)",
        notes:
          "Automatically provisioned Digipay test settlement account. Used for simulated TEST payments.",
      },
      LIVE: {
        name: "Digipay Live Settlement",
        institution: "Digipay UPG",
        notes:
          "Automatically provisioned Digipay live account. Receives verified installment and wallet purchases before settlement.",
      },
    },
  },
}

/**
 * Ensures a supported payment gateway and both its `TEST` and `LIVE`
 * provider financial accounts exist and are active.
 *
 * Gateways are defined in code (Sadad, Zarinpal, Mellat and Digipay); they are never manually
 * added, edited, or deleted from the admin panel.
 */
export async function ensurePaymentGateway(code: string) {
  const definition = GATEWAYS[code]

  if (!definition) {
    throw new Error(`Unknown payment gateway ${code}.`)
  }

  const db = getDb()

  const provider = await db.paymentProvider.upsert({
    where: { code },
    update: {
      name: definition.name,
      isActive: true,
    },
    create: {
      code,
      name: definition.name,
      description: definition.description,
      isActive: true,
    },
  })

  const existingAccounts = await db.financialAccount.findMany({
    where: {
      providerId: provider.id,
      kind: "PROVIDER",
    },
    orderBy: { createdAt: "asc" },
  })

  const accounts = {} as Record<
    ProviderEnvironmentValue,
    (typeof existingAccounts)[number]
  >

  for (const environment of ["TEST", "LIVE"] as const) {
    let account = existingAccounts.find(
      (candidate) => candidate.environment === environment
    )
    const template = definition.accounts[environment]

    if (!account) {
      account = await db.financialAccount.create({
        data: {
          name: template.name,
          kind: "PROVIDER",
          providerId: provider.id,
          environment,
          institution: template.institution,
          currency: "IRR",
          openingBalance: 0,
          isActive: true,
          notes: template.notes,
        },
      })
    } else if (!account.isActive) {
      account = await db.financialAccount.update({
        where: { id: account.id },
        data: { isActive: true },
      })
    }

    accounts[environment] = account
  }

  return { provider, accounts }
}

export async function ensureSadadGateway() {
  return ensurePaymentGateway(SADAD_PROVIDER_CODE)
}

export async function ensureAllPaymentGateways() {
  return Promise.all(Object.keys(GATEWAYS).map(ensurePaymentGateway))
}

export async function getGatewayAccountForEnvironment(
  code: string,
  environment: ProviderEnvironmentValue
) {
  const { provider, accounts } = await ensurePaymentGateway(code)
  return {
    provider,
    account: accounts[environment],
  }
}

export async function getSadadAccountForEnvironment(
  environment: ProviderEnvironmentValue
) {
  return getGatewayAccountForEnvironment(SADAD_PROVIDER_CODE, environment)
}

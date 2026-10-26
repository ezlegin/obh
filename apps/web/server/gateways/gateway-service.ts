import "server-only"

import { getDb } from "@/lib/db/client"
import {
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
} from "@/server/payments/providers/registry"
import type { ProviderEnvironmentValue } from "@/server/payments/providers/types"

const SADAD_ACCOUNTS: Record<
  ProviderEnvironmentValue,
  { name: string; institution: string; notes: string }
> = {
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
}

/**
 * Ensures the single Sadad payment gateway (`code: "sadad"`) and both its
 * `TEST` and `LIVE` provider financial accounts exist and are active.
 *
 * OBH operates exclusively on Sadad (Bank Melli Iran); gateways are never
 * manually added, edited, or deleted from the admin panel.
 */
export async function ensureSadadGateway() {
  const db = getDb()

  const provider = await db.paymentProvider.upsert({
    where: { code: SADAD_PROVIDER_CODE },
    update: {
      name: SADAD_PROVIDER_NAME,
      isActive: true,
    },
    create: {
      code: SADAD_PROVIDER_CODE,
      name: SADAD_PROVIDER_NAME,
      description:
        "Official Sadad (Bank Melli Iran) Internet Payment Gateway (`sadad.shaparak.ir`). Single gateway for all OBH connected services.",
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

  let testAccount = existingAccounts.find(
    (account) => account.environment === "TEST"
  )
  let liveAccount = existingAccounts.find(
    (account) => account.environment === "LIVE"
  )

  if (!testAccount) {
    testAccount = await db.financialAccount.create({
      data: {
        name: SADAD_ACCOUNTS.TEST.name,
        kind: "PROVIDER",
        providerId: provider.id,
        environment: "TEST",
        institution: SADAD_ACCOUNTS.TEST.institution,
        currency: "IRR",
        openingBalance: 0,
        isActive: true,
        notes: SADAD_ACCOUNTS.TEST.notes,
      },
    })
  } else if (!testAccount.isActive) {
    testAccount = await db.financialAccount.update({
      where: { id: testAccount.id },
      data: { isActive: true },
    })
  }

  if (!liveAccount) {
    liveAccount = await db.financialAccount.create({
      data: {
        name: SADAD_ACCOUNTS.LIVE.name,
        kind: "PROVIDER",
        providerId: provider.id,
        environment: "LIVE",
        institution: SADAD_ACCOUNTS.LIVE.institution,
        currency: "IRR",
        openingBalance: 0,
        isActive: true,
        notes: SADAD_ACCOUNTS.LIVE.notes,
      },
    })
  } else if (!liveAccount.isActive) {
    liveAccount = await db.financialAccount.update({
      where: { id: liveAccount.id },
      data: { isActive: true },
    })
  }

  return {
    provider,
    accounts: {
      TEST: testAccount,
      LIVE: liveAccount,
    },
  }
}

export async function getSadadAccountForEnvironment(
  environment: ProviderEnvironmentValue
) {
  const { provider, accounts } = await ensureSadadGateway()
  return {
    provider,
    account: accounts[environment],
  }
}

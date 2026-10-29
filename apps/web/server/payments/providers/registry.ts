import {
  DIGIPAY_PROVIDER_CODE,
  DIGIPAY_PROVIDER_NAME,
  digipayPaymentAdapter,
  getDigipayConfigStatus,
  isDigipaySimulatorEnabled,
} from "./digipay"
import {
  getSadadConfigStatus,
  isSadadSimulatorEnabled,
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
  sadadPaymentAdapter,
} from "./sadad"
import type {
  PaymentGatewayDescriptor,
  PaymentProviderAdapter,
  ProviderEnvironmentValue,
} from "./types"
import {
  isMellatSimulatorEnabled,
  MELLAT_PROVIDER_CODE,
  MELLAT_PROVIDER_NAME,
  mellatPaymentAdapter,
  getMellatConfigStatus,
} from "./mellat"
import {
  getZarinpalConfigStatus,
  isZarinpalSimulatorEnabled,
  ZARINPAL_PROVIDER_CODE,
  ZARINPAL_PROVIDER_NAME,
  zarinpalPaymentAdapter,
} from "./zarinpal"

/** Gateway used when a service does not choose one. */
export const DEFAULT_PROVIDER_CODE = SADAD_PROVIDER_CODE

const adapters = new Map<string, PaymentProviderAdapter>([
  [sadadPaymentAdapter.code, sadadPaymentAdapter],
  [zarinpalPaymentAdapter.code, zarinpalPaymentAdapter],
  [mellatPaymentAdapter.code, mellatPaymentAdapter],
  [digipayPaymentAdapter.code, digipayPaymentAdapter],
])

export function isKnownPaymentProvider(code: string) {
  return adapters.has(code)
}

export function getPaymentProviderAdapter(
  code: string = DEFAULT_PROVIDER_CODE
): PaymentProviderAdapter {
  const adapter = adapters.get(code)

  if (!adapter) {
    throw new Error(
      `No server-side adapter is registered for provider ${code}. OBH supports ${[...adapters.keys()].join(", ")}.`
    )
  }

  return adapter
}

export function providerSupportsEnvironment(
  code: string,
  environment: ProviderEnvironmentValue
) {
  const adapter = getPaymentProviderAdapter(code)

  return (
    adapter.supportedEnvironments.includes(environment) &&
    (environment === "TEST" || adapter.isLiveConfigured())
  )
}

export type AvailablePaymentGateway = PaymentGatewayDescriptor & {
  isDefault: boolean
}

/**
 * Gateways a connected service can offer at checkout for one environment.
 * TEST always uses the OBH simulators; LIVE lists only gateways whose
 * credentials are configured on the server.
 */
export function listAvailablePaymentGateways(
  environment: ProviderEnvironmentValue
): AvailablePaymentGateway[] {
  return [...adapters.values()]
    .filter((adapter) => providerSupportsEnvironment(adapter.code, environment))
    .map((adapter) => ({
      ...adapter.descriptor,
      isDefault: adapter.code === DEFAULT_PROVIDER_CODE,
    }))
}

export type AdminPaymentGatewayOption = PaymentGatewayDescriptor & {
  isDefault: boolean
  liveConfigured: boolean
}

/** Every registered gateway with its LIVE availability, for admin forms. */
export function listPaymentGatewaysForAdmin(): AdminPaymentGatewayOption[] {
  return [...adapters.values()].map((adapter) => ({
    ...adapter.descriptor,
    isDefault: adapter.code === DEFAULT_PROVIDER_CODE,
    liveConfigured: adapter.isLiveConfigured(),
  }))
}

export {
  DIGIPAY_PROVIDER_CODE,
  DIGIPAY_PROVIDER_NAME,
  digipayPaymentAdapter,
  getDigipayConfigStatus,
  getSadadConfigStatus,
  getZarinpalConfigStatus,
  isDigipaySimulatorEnabled,
  isSadadSimulatorEnabled,
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
  sadadPaymentAdapter,
  isZarinpalSimulatorEnabled,
  ZARINPAL_PROVIDER_CODE,
  ZARINPAL_PROVIDER_NAME,
  zarinpalPaymentAdapter,
  isMellatSimulatorEnabled,
  MELLAT_PROVIDER_CODE,
  MELLAT_PROVIDER_NAME,
  mellatPaymentAdapter,
  getMellatConfigStatus,
}

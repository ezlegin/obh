import {
  DEVELOPMENT_PROVIDER_CODE,
  developmentPaymentAdapter,
  isDevelopmentProviderEnabled,
} from "./development"
import type { PaymentProviderAdapter, ProviderEnvironmentValue } from "./types"

const adapters = new Map<string, PaymentProviderAdapter>([
  [developmentPaymentAdapter.code, developmentPaymentAdapter],
])

export function getPaymentProviderAdapter(
  code: string
): PaymentProviderAdapter {
  if (code === DEVELOPMENT_PROVIDER_CODE && !isDevelopmentProviderEnabled()) {
    throw new Error(
      "The development provider is disabled in production. Set OBH_ENABLE_DEVELOPMENT_PROVIDER=true only in an approved test environment."
    )
  }

  const adapter = adapters.get(code)

  if (!adapter) {
    throw new Error(
      `No server-side adapter is registered for provider ${code}.`
    )
  }

  return adapter
}

export function providerSupportsEnvironment(
  code: string,
  environment: ProviderEnvironmentValue
) {
  return getPaymentProviderAdapter(code).supportedEnvironments.includes(
    environment
  )
}

export { DEVELOPMENT_PROVIDER_CODE } from "./development"
export { isDevelopmentProviderEnabled } from "./development"

import { developmentPaymentAdapter } from "./development"
import type { PaymentProviderAdapter, ProviderEnvironmentValue } from "./types"

const adapters = new Map<string, PaymentProviderAdapter>([
  [developmentPaymentAdapter.code, developmentPaymentAdapter],
])

export function getPaymentProviderAdapter(
  code: string
): PaymentProviderAdapter {
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

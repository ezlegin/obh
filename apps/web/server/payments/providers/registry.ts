import {
  getSadadConfigStatus,
  isSadadSimulatorEnabled,
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
  sadadPaymentAdapter,
} from "./sadad"
import type { PaymentProviderAdapter, ProviderEnvironmentValue } from "./types"

const adapters = new Map<string, PaymentProviderAdapter>([
  [sadadPaymentAdapter.code, sadadPaymentAdapter],
])

export function getPaymentProviderAdapter(
  code: string = SADAD_PROVIDER_CODE
): PaymentProviderAdapter {
  const adapter = adapters.get(code)

  if (!adapter) {
    throw new Error(
      `No server-side adapter is registered for provider ${code}. OBH only supports ${SADAD_PROVIDER_CODE}.`
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

export {
  getSadadConfigStatus,
  isSadadSimulatorEnabled,
  SADAD_PROVIDER_CODE,
  SADAD_PROVIDER_NAME,
  sadadPaymentAdapter,
}

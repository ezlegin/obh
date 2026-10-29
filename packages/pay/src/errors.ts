export type PayErrorCode =
  | "INVALID_REQUEST"
  | "GATEWAY_NOT_AVAILABLE"
  | "GATEWAY_ERROR"
  | "ORDER_ALREADY_PAID"
  | "PAYMENT_NOT_FOUND"
  | "ORDER_MISMATCH"
  | "INVALID_CALLBACK"
  | "REPORT_FAILED"

/** Error raised by the package. `code` is stable; `message` is for logs. */
export class PayError extends Error {
  readonly code: PayErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: PayErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "PayError"
    this.code = code
    this.details = details
  }
}

export function isPayError(error: unknown): error is PayError {
  return error instanceof PayError
}

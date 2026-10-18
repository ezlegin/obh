import type { APIErrorDetail } from "./types.js"

export class OBHPaymentsError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId?: string
  readonly details?: APIErrorDetail[]
  readonly retryable: boolean

  constructor(
    message: string,
    options: {
      code: string
      status?: number
      requestId?: string
      details?: APIErrorDetail[]
      retryable?: boolean
      cause?: unknown
    }
  ) {
    super(message)
    this.name = "OBHPaymentsError"
    this.code = options.code
    this.status = options.status
    this.requestId = options.requestId
    this.details = options.details
    this.retryable = options.retryable ?? false

    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

export function isOBHPaymentsError(error: unknown): error is OBHPaymentsError {
  return error instanceof OBHPaymentsError
}

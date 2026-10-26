export type PaymentLifecycleStatus =
  "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "EXPIRED"

const allowedTransitions: Record<
  PaymentLifecycleStatus,
  readonly PaymentLifecycleStatus[]
> = {
  PENDING: ["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
}

export const PAYMENT_EVENT_TYPES = {
  CREATED: "payment.created",
  PROVIDER_SESSION_CREATED: "payment.provider_session_created",
  CALLBACK_RECEIVED: "payment.callback_received",
  VERIFIED: "payment.verified",
  FAILED: "payment.failed",
  CANCELLED: "payment.cancelled",
  EXPIRED: "payment.expired",
} as const

export class InvalidPaymentTransitionError extends Error {
  from: PaymentLifecycleStatus
  to: PaymentLifecycleStatus

  constructor(from: PaymentLifecycleStatus, to: PaymentLifecycleStatus) {
    super(`Payment cannot transition from ${from} to ${to}.`)
    this.name = "InvalidPaymentTransitionError"
    this.from = from
    this.to = to
  }
}

export function canTransitionPayment(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus
) {
  return allowedTransitions[from].includes(to)
}

export function assertPaymentTransition(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus
) {
  if (!canTransitionPayment(from, to)) {
    throw new InvalidPaymentTransitionError(from, to)
  }
}

export function isTerminalPaymentStatus(status: PaymentLifecycleStatus) {
  return allowedTransitions[status].length === 0
}

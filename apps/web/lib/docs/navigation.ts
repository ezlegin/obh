import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Boxes,
  Braces,
  Bug,
  CircleCheck,
  CreditCard,
  FileCode2,
  KeyRound,
  Landmark,
  LifeBuoy,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Webhook,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  description?: string
  icon?: LucideIcon
  badge?: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    title: "Getting started",
    items: [
      {
        title: "Introduction",
        href: "/docs/docs",
        description: "What the OBH Payment SDK is and when to use it.",
        icon: BookOpen,
      },
      {
        title: "Quickstart",
        href: "/docs/quickstart",
        description: "Install the SDK and accept your first payment.",
        icon: Rocket,
      },
      {
        title: "How payments work",
        href: "/docs/concepts",
        description: "The cast, the lifecycle, and the source of truth.",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    title: "Building",
    items: [
      {
        title: "Create a payment",
        href: "/docs/payments/create",
        description: "startPayment, its inputs, and its guarantees.",
        icon: CreditCard,
      },
      {
        title: "Gateways & installments",
        href: "/docs/gateways",
        description:
          "listGateways, a gateway picker, and Digipay installments.",
        icon: Landmark,
        badge: "New",
      },
      {
        title: "Check status",
        href: "/docs/payments/retrieve",
        description: "getPayment, polling, and reconciliation.",
        icon: CircleCheck,
      },
      {
        title: "Idempotency & retries",
        href: "/docs/idempotency",
        description: "Retry safely without double-charging.",
        icon: Braces,
      },
      {
        title: "Webhooks",
        href: "/docs/webhooks",
        description: "Verify signatures and react to payment events.",
        icon: Webhook,
      },
    ],
  },
  {
    title: "Reference",
    items: [
      {
        title: "Configuration",
        href: "/docs/configuration",
        description: "Client options, base URLs, and timeouts.",
        icon: KeyRound,
      },
      {
        title: "Errors",
        href: "/docs/errors",
        description: "Typed errors, API codes, and recovery.",
        icon: AlertTriangle,
      },
      {
        title: "API reference",
        href: "/docs/api-reference",
        description: "Every method, type, and HTTP endpoint.",
        icon: FileCode2,
      },
    ],
  },
  {
    title: "Guides",
    items: [
      {
        title: "Next.js integration",
        href: "/docs/guides/nextjs",
        description: "Route handlers, return pages, and webhooks.",
        icon: Boxes,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        title: "Security",
        href: "/docs/security",
        description: "The threat model and your responsibilities.",
        icon: ShieldCheck,
      },
      {
        title: "Troubleshooting",
        href: "/docs/troubleshooting",
        description: "Fix the errors you will actually see.",
        icon: Bug,
      },
    ],
  },
]

export const flatNavigation: NavItem[] = navigation.flatMap(
  (group) => group.items
)

export function getAdjacentDocs(href: string) {
  const index = flatNavigation.findIndex((item) => item.href === href)

  if (index === -1) {
    return { previous: undefined, next: undefined }
  }

  return {
    previous: index > 0 ? flatNavigation[index - 1] : undefined,
    next:
      index < flatNavigation.length - 1 ? flatNavigation[index + 1] : undefined,
  }
}

export const docMeta = {
  packageName: "@obhco/payments",
  version: "0.1.0",
  apiVersion: "v1",
  apiBasePath: "/api/v1",
  nodeRequirement: "Node.js 20+",
  supportIcon: LifeBuoy,
  lockIcon: LockKeyhole,
} as const

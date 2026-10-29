import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  FileText,
  LayoutDashboard,
  PieChart,
  Receipt,
  Scale,
  Settings,
  Users,
  WalletCards,
} from "lucide-react"

export type AdminNavItem = {
  label: string
  href: string
  description: string
  icon: LucideIcon
  exact?: boolean
  disabled?: boolean
  badge?: string
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

export const adminNavigation: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        description: "The operating overview for OBH.",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Payments",
        href: "/admin/payments",
        description: "Incoming payments and transaction history.",
        icon: CreditCard,
      },
      {
        label: "Installments",
        href: "/admin/installments",
        description:
          "Installment purchases, deposits received, and amounts still owed.",
        icon: CalendarClock,
      },
      {
        label: "Services",
        href: "/admin/services",
        description: "Connected services and payment credentials.",
        icon: Boxes,
      },
      {
        label: "API logs",
        href: "/admin/api-logs",
        description: "Authenticated service API calls and responses.",
        icon: Activity,
      },
      {
        label: "Reconciliation",
        href: "/admin/reconciliation",
        description: "Provider settlements, fees, and account reconciliation.",
        icon: Scale,
      },
    ],
  },
  {
    label: "Accounting",
    items: [
      {
        label: "Expenses",
        href: "/admin/expenses",
        description: "Operating costs and supporting documents.",
        icon: Receipt,
      },
      {
        label: "Income",
        href: "/admin/income",
        description: "Additional business income records.",
        icon: CircleDollarSign,
      },
      {
        label: "Payment sources",
        href: "/admin/accounts",
        description: "Business accounts used for income and expenses.",
        icon: WalletCards,
      },
      {
        label: "Reports",
        href: "/admin/reports",
        description: "Revenue, expenses, profit, and exports.",
        icon: FileText,
      },
    ],
  },
  {
    label: "Equity",
    items: [
      {
        label: "Shareholders",
        href: "/admin/shareholders",
        description: "Ownership history and capital contributions.",
        icon: Users,
      },
      {
        label: "Distributions",
        href: "/admin/distributions",
        description: "Profit periods, allocations, and payouts.",
        icon: PieChart,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        description: "Business, payment, and security settings.",
        icon: Settings,
        disabled: true,
        badge: "Soon",
      },
    ],
  },
]

export const adminNavItems = adminNavigation.flatMap((group) => group.items)

export function isAdminNavActive(item: AdminNavItem, pathname: string) {
  if (item.exact) {
    return pathname === item.href
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

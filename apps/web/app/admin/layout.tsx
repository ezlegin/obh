import type { Metadata } from "next"

import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdmin } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s — OBH Admin",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await requireAdmin()

  return <AdminShell user={user}>{children}</AdminShell>
}

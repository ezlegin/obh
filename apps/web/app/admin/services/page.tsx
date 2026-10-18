import type { Metadata } from "next"
import { Boxes } from "lucide-react"

import { AdminModuleView } from "@/components/admin/admin-module-view"

export const metadata: Metadata = {
  title: "Connected services",
}

export default function AdminServicesPage() {
  return (
    <AdminModuleView
      eyebrow="Admin / Operations"
      title="Connected services"
      description="The services that use OBH payment infrastructure, their approved return URLs, and securely managed credentials."
      emptyDescription="Registered services and credential lifecycle will appear here."
      icon={Boxes}
    />
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ServiceDetail } from "@/components/admin/services/service-detail"
import { getServiceWorkspace } from "@/server/services/service-queries"

type ServicePageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: ServicePageProps): Promise<Metadata> {
  const { id } = await params
  const data = await getServiceWorkspace(id)

  return {
    title: data ? `${data.service.name} · Service` : "Service",
  }
}

export default async function AdminServicePage({ params }: ServicePageProps) {
  const { id } = await params
  const data = await getServiceWorkspace(id)

  if (!data) {
    notFound()
  }

  return <ServiceDetail data={data} />
}

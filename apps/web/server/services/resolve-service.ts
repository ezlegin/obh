import "server-only"

import { getDb } from "@/lib/db/client"
import { DomainError } from "@/server/errors"

export async function resolveServiceId(
  serviceId?: string | null
): Promise<string | null> {
  if (!serviceId) {
    return null
  }

  const service = await getDb().connectedService.findUnique({
    where: { id: serviceId },
    select: { id: true },
  })

  if (!service) {
    throw new DomainError(
      "SERVICE_NOT_FOUND",
      "The selected service was not found."
    )
  }

  return service.id
}

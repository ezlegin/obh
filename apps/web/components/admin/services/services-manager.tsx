"use client"

import {
  Boxes,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  Webhook,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"

import { AdminEmptyState } from "@/components/admin/empty-state"
import { CredentialSecretDialog } from "@/components/admin/services/credential-secret-dialog"
import type { IssuedCredential } from "@/components/admin/services/issue-credential-dialog"
import { RegisterServiceDialog } from "@/components/admin/services/register-service-dialog"
import {
  WebhookSecretDialog,
  type IssuedWebhookSecret,
} from "@/components/admin/services/webhook-secret-dialog"
import {
  deleteConnectedServiceAction,
  issueServiceCredentialAction,
  rotateWebhookSecretAction,
  toggleConnectedServiceAction,
} from "@/app/admin/services/actions"
import type { AdminConnectedService } from "@/server/payments/queries"
import { formatDevelopmentDate } from "@/lib/admin/format"

type ServicesManagerProps = {
  services: AdminConnectedService[]
}

function ServicesManager({ services }: ServicesManagerProps) {
  const router = useRouter()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editingService, setEditingService] =
    useState<AdminConnectedService | null>(null)
  const [issuedCredential, setIssuedCredential] =
    useState<IssuedCredential | null>(null)
  const [issuedWebhookSecret, setIssuedWebhookSecret] =
    useState<IssuedWebhookSecret | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const refresh = () => router.refresh()

  const copyCredentialKey = async (credentialId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(credentialId)
      window.setTimeout(() => {
        setCopiedId((current) => (current === credentialId ? null : current))
      }, 2000)
    } catch {
      setError("Could not copy credential to clipboard.")
    }
  }

  const toggleRevealCredential = (credentialId: string) => {
    setRevealedIds((current) => ({
      ...current,
      [credentialId]: !current[credentialId],
    }))
  }

  const toggleService = async (service: AdminConnectedService) => {
    setPendingKey(`service:${service.id}`)
    setError(null)

    const result = await toggleConnectedServiceAction({
      serviceId: service.id,
      isActive: !service.isActive,
    })

    if (!result.ok) {
      setError(result.error ?? "The service status could not be changed.")
    } else {
      refresh()
    }

    setPendingKey(null)
  }

  const deleteService = async (service: AdminConnectedService) => {
    if (
      !window.confirm(
        `Delete service "${service.name}" (${service.domain})? Its API key will be removed immediately.`
      )
    ) {
      return
    }

    setPendingKey(`delete:${service.id}`)
    setError(null)

    const result = await deleteConnectedServiceAction({
      serviceId: service.id,
    })

    if (!result.ok) {
      setError(result.error ?? "The service could not be deleted.")
    } else {
      refresh()
    }

    setPendingKey(null)
  }

  const regenerateApiKey = async (service: AdminConnectedService) => {
    if (
      !window.confirm(
        `Regenerate the API key for "${service.name}"? The previous key will stop working immediately.`
      )
    ) {
      return
    }

    setPendingKey(`regen:${service.id}`)
    setError(null)

    const result = await issueServiceCredentialAction({
      serviceId: service.id,
      label: "API key",
      environment: "LIVE",
    })

    if (!result.ok || !result.presentedKey || !result.credential) {
      setError(result.error ?? "The API key could not be regenerated.")
    } else {
      setIssuedCredential({
        presentedKey: result.presentedKey,
        keyId: result.credential.keyId,
        label: result.credential.label,
        environment: result.credential.environment,
        createdAt: result.credential.createdAt,
      })
      refresh()
    }

    setPendingKey(null)
  }

  const rotateWebhook = async (service: AdminConnectedService) => {
    if (
      service.webhookSecretConfigured &&
      !window.confirm(
        `Rotate the webhook signing secret for ${service.name}? Existing verification will fail until the service is updated.`
      )
    ) {
      return
    }

    setPendingKey(`webhook:${service.id}`)
    setError(null)

    const result = await rotateWebhookSecretAction({ serviceId: service.id })

    if (!result.ok || !result.webhookSecret) {
      setError(result.error ?? "The webhook secret could not be created.")
    } else {
      setIssuedWebhookSecret({
        secret: result.webhookSecret,
        serviceName: service.name,
        createdAt: result.webhookSecretCreatedAt ?? new Date().toISOString(),
      })
      refresh()
    }

    setPendingKey(null)
  }

  return (
    <>
      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Connected services
          </p>
          <Badge variant="outline">{services.length} total</Badge>
        </div>
        <Button type="button" onClick={() => setRegisterOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Generate service
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-xs leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      {services.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card/40">
          <AdminEmptyState
            icon={Boxes}
            title="No connected services yet"
            description="Generate your first connected service to automatically create its OBH API key."
            action={
              <Button type="button" onClick={() => setRegisterOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                Generate first service
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {services.map((service) => {
            const credential = service.credentials[0]
            const isRevealed = credential
              ? Boolean(revealedIds[credential.id])
              : false
            const isCopied = credential ? copiedId === credential.id : false

            return (
              <article
                key={service.id}
                className="overflow-hidden rounded-2xl border border-border bg-card/40"
              >
                <div className="flex flex-col justify-between gap-5 border-b border-border p-5 sm:flex-row sm:items-start sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-medium tracking-[-0.025em]">
                        {service.name}
                      </h2>
                      <Badge variant={service.isActive ? "success" : "muted"}>
                        {service.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tracking-[0.05em] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Globe2 aria-hidden="true" className="size-3" />
                        {service.domain}
                      </span>
                      <span>/{service.slug}</span>
                      <span>{service.paymentCount} payments</span>
                    </p>
                    {service.description ? (
                      <p className="mt-3 max-w-2xl text-xs leading-5 text-muted-foreground">
                        {service.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/admin/services/${service.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Open
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingService(service)}
                      disabled={
                        pendingKey === `delete:${service.id}` ||
                        pendingKey === `service:${service.id}`
                      }
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleService(service)}
                      disabled={
                        pendingKey === `service:${service.id}` ||
                        pendingKey === `delete:${service.id}`
                      }
                    >
                      {pendingKey === `service:${service.id}` ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-3.5 animate-spin"
                        />
                      ) : (
                        <Power aria-hidden="true" className="size-3.5" />
                      )}
                      {service.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteService(service)}
                      disabled={
                        pendingKey === `delete:${service.id}` ||
                        pendingKey === `service:${service.id}`
                      }
                      className="text-danger hover:bg-danger/10 hover:text-danger"
                    >
                      {pendingKey === `delete:${service.id}` ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-3.5 animate-spin"
                        />
                      ) : (
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {credential ? (
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-medium">
                              Service API key
                            </p>
                            <Badge variant="success">Active</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                            <span className="break-all">
                              {isRevealed
                                ? credential.presentedKey
                                : `${credential.keyId}.••••••••••••••••••••••••`}
                            </span>
                            <div className="inline-flex flex-wrap items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() =>
                                  toggleRevealCredential(credential.id)
                                }
                                aria-label={
                                  isRevealed
                                    ? "Hide secret key"
                                    : "Show secret key"
                                }
                              >
                                {isRevealed ? (
                                  <EyeOff
                                    aria-hidden="true"
                                    className="size-3"
                                  />
                                ) : (
                                  <Eye aria-hidden="true" className="size-3" />
                                )}
                                {isRevealed ? "Hide" : "Show"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  copyCredentialKey(
                                    credential.id,
                                    credential.presentedKey
                                  )
                                }
                              >
                                {isCopied ? (
                                  <>
                                    <Check
                                      aria-hidden="true"
                                      className="size-3"
                                    />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy
                                      aria-hidden="true"
                                      className="size-3"
                                    />
                                    Copy key
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => regenerateApiKey(service)}
                                disabled={pendingKey === `regen:${service.id}`}
                              >
                                {pendingKey === `regen:${service.id}` ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="size-3 animate-spin"
                                  />
                                ) : (
                                  <RefreshCw
                                    aria-hidden="true"
                                    className="size-3"
                                  />
                                )}
                                Regenerate
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[9px] text-muted-foreground/55">
                            Created{" "}
                            {formatDevelopmentDate(credential.createdAt)}
                          </p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground/45">
                            Last used{" "}
                            {credential.lastUsedAt
                              ? formatDevelopmentDate(credential.lastUsedAt)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {service.webhookUrl ? (
                    <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-border bg-white/[0.02] p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-medium">
                          <Webhook aria-hidden="true" className="size-3.5" />
                          Webhook notifications
                          <Badge
                            variant={
                              service.webhookSecretConfigured
                                ? "success"
                                : "warning"
                            }
                          >
                            {service.webhookSecretConfigured
                              ? "Signed"
                              : "Not configured"}
                          </Badge>
                        </p>
                        <p className="mt-1 max-w-xl truncate font-mono text-[9px] text-muted-foreground/60">
                          {service.webhookUrl}
                        </p>
                        {service.webhookSecret ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                            <span className="break-all">
                              {revealedIds[`wh:${service.id}`]
                                ? service.webhookSecret
                                : "whsec_••••••••••••••••••••••••"}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                toggleRevealCredential(`wh:${service.id}`)
                              }
                            >
                              {revealedIds[`wh:${service.id}`] ? (
                                <EyeOff aria-hidden="true" className="size-3" />
                              ) : (
                                <Eye aria-hidden="true" className="size-3" />
                              )}
                              {revealedIds[`wh:${service.id}`]
                                ? "Hide"
                                : "Show"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                copyCredentialKey(
                                  `wh:${service.id}`,
                                  service.webhookSecret!
                                )
                              }
                            >
                              {copiedId === `wh:${service.id}` ? (
                                <>
                                  <Check
                                    aria-hidden="true"
                                    className="size-3"
                                  />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy aria-hidden="true" className="size-3" />
                                  Copy secret
                                </>
                              )}
                            </Button>
                          </div>
                        ) : null}
                        {service.webhookSecretCreatedAt ? (
                          <p className="mt-1 text-[9px] text-muted-foreground/45">
                            Last rotated{" "}
                            {formatDevelopmentDate(
                              service.webhookSecretCreatedAt
                            )}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => rotateWebhook(service)}
                        disabled={pendingKey === `webhook:${service.id}`}
                        className="shrink-0"
                      >
                        {pendingKey === `webhook:${service.id}` ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-3.5 animate-spin"
                          />
                        ) : (
                          <Webhook aria-hidden="true" className="size-3.5" />
                        )}
                        {service.webhookSecretConfigured
                          ? "Rotate signing secret"
                          : "Generate signing secret"}
                      </Button>
                    </div>
                  ) : null}

                  {service.allowedReturnUrls.length > 0 ? (
                    <details className="mt-4 rounded-xl border border-border">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[11px] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none">
                        <Link2 aria-hidden="true" className="size-3.5" />
                        Allowed return URLs ({service.allowedReturnUrls.length})
                      </summary>
                      <div className="space-y-1.5 border-t border-border p-4">
                        {service.defaultReturnUrl ? (
                          <p className="mb-3 border-b border-border pb-3 font-mono text-[10px] break-all text-info">
                            Default: {service.defaultReturnUrl}
                          </p>
                        ) : null}
                        {service.allowedReturnUrls.map((url) => (
                          <p
                            key={url}
                            className="font-mono text-[10px] break-all text-muted-foreground"
                          >
                            {url}
                          </p>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <RegisterServiceDialog
        open={registerOpen || Boolean(editingService)}
        service={editingService}
        onOpenChange={(open) => {
          if (!open) {
            setRegisterOpen(false)
            setEditingService(null)
          }
        }}
        onCreated={(credential) => {
          if (credential) {
            setIssuedCredential(credential)
          }
          setRegisterOpen(false)
          setEditingService(null)
          refresh()
        }}
      />
      <CredentialSecretDialog
        credential={issuedCredential}
        onClose={() => setIssuedCredential(null)}
      />
      <WebhookSecretDialog
        data={issuedWebhookSecret}
        onClose={() => setIssuedWebhookSecret(null)}
      />
    </>
  )
}

export { ServicesManager }

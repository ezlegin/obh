"use client"

import {
  Ban,
  Boxes,
  Copy,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Power,
  Webhook,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AdminEmptyState } from "@/components/admin/empty-state"
import { CredentialSecretDialog } from "@/components/admin/services/credential-secret-dialog"
import {
  IssueCredentialDialog,
  type IssuedCredential,
} from "@/components/admin/services/issue-credential-dialog"
import { RegisterServiceDialog } from "@/components/admin/services/register-service-dialog"
import {
  WebhookSecretDialog,
  type IssuedWebhookSecret,
} from "@/components/admin/services/webhook-secret-dialog"
import {
  revokeServiceCredentialAction,
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
  const [credentialTarget, setCredentialTarget] =
    useState<AdminConnectedService | null>(null)
  const [issuedCredential, setIssuedCredential] =
    useState<IssuedCredential | null>(null)
  const [issuedWebhookSecret, setIssuedWebhookSecret] =
    useState<IssuedWebhookSecret | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => router.refresh()

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

  const revokeCredential = async (
    service: AdminConnectedService,
    credentialId: string,
    keyId: string
  ) => {
    if (
      !window.confirm(
        `Revoke credential ${keyId}? The connected service will lose access immediately.`
      )
    ) {
      return
    }

    setPendingKey(`credential:${credentialId}`)
    setError(null)

    const result = await revokeServiceCredentialAction({ credentialId })

    if (!result.ok) {
      setError(result.error ?? "The credential could not be revoked.")
    } else {
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
            Registered services
          </p>
          <Badge variant="outline">{services.length} total</Badge>
        </div>
        <Button type="button" onClick={() => setRegisterOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Register service
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

      <div className="mt-4">
        <div className="rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-info/20 bg-info/10 text-info">
              <KeyRound aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="text-xs font-medium">Credentials are shown once</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                OBH stores only a one-way hash of each service secret. Only TEST
                credentials can be issued until live provider integration is
                approved.
              </p>
            </div>
          </div>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card/40">
          <AdminEmptyState
            icon={Boxes}
            title="No connected services yet"
            description="Register the first OBH service to begin issuing payment credentials. No service has been created automatically."
            action={
              <Button type="button" onClick={() => setRegisterOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                Register the first service
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {services.map((service) => {
            const activeCredentials = service.credentials.filter(
              (credential) => !credential.revokedAt
            )

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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCredentialTarget(service)}
                      disabled={
                        pendingKey === `service:${service.id}` ||
                        !service.isActive
                      }
                    >
                      <KeyRound aria-hidden="true" className="size-3.5" />
                      Issue test credential
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleService(service)}
                      disabled={pendingKey === `service:${service.id}`}
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
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground/60 uppercase">
                      Credentials · {activeCredentials.length} active
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setCredentialTarget(service)}
                      disabled={!service.isActive}
                    >
                      <Plus aria-hidden="true" className="size-3" />
                      New test credential
                    </Button>
                  </div>

                  {service.credentials.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                      No credentials have been issued for this service.
                    </p>
                  ) : (
                    <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                      {service.credentials.map((credential) => (
                        <div
                          key={credential.id}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-medium">
                                {credential.label}
                              </p>
                              <Badge
                                variant={
                                  credential.environment === "TEST"
                                    ? "warning"
                                    : "success"
                                }
                              >
                                {credential.environment}
                              </Badge>
                              {credential.revokedAt ? (
                                <Badge variant="muted">Revoked</Badge>
                              ) : (
                                <Badge variant="success">Active</Badge>
                              )}
                            </div>
                            <p className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                              <Copy aria-hidden="true" className="size-3" />
                              {credential.keyId}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-4">
                            <div className="text-right">
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
                            {!credential.revokedAt ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Revoke credential ${credential.keyId}`}
                                onClick={() =>
                                  revokeCredential(
                                    service,
                                    credential.id,
                                    credential.keyId
                                  )
                                }
                                disabled={
                                  pendingKey === `credential:${credential.id}`
                                }
                              >
                                {pendingKey ===
                                `credential:${credential.id}` ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="size-3.5 animate-spin"
                                  />
                                ) : (
                                  <Ban
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                )}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onCreated={refresh}
      />
      <IssueCredentialDialog
        service={credentialTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCredentialTarget(null)
          }
        }}
        onIssued={(credential) => {
          setCredentialTarget(null)
          setIssuedCredential(credential)
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

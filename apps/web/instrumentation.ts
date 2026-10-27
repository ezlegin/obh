// Runs the webhook retry worker inside the web server, instead of a cron job
// that started a whole extra container every minute. Production runs a single
// web instance, so there is only ever one worker (see DEPLOYMENT.md).
// Set OBH_WEBHOOK_WORKER=false to turn it off; it is off in development
// unless set to true.

const INTERVAL_MS = 60_000

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const setting = process.env.OBH_WEBHOOK_WORKER
  const enabled =
    setting === undefined
      ? process.env.NODE_ENV === "production"
      : setting === "true"

  if (!enabled) return

  let running = false

  const tick = async () => {
    if (running) return
    running = true

    try {
      const { processDueWebhooks } =
        await import("./server/payments/webhook-service")
      const result = await processDueWebhooks()

      if (result.processed > 0) {
        console.log(
          `Webhook worker: processed ${result.processed}, delivered ${result.delivered}, retry/failed ${result.failed}.`
        )
      }
    } catch (error) {
      console.error(
        "Webhook worker failed.",
        error instanceof Error ? error.name : "Unknown error"
      )
    } finally {
      running = false
    }
  }

  setInterval(tick, INTERVAL_MS).unref()
}

import { config } from "dotenv"

config({ path: ".env.local" })
config()

import { processDueWebhooks } from "../server/payments/webhook-service"

const result = await processDueWebhooks()
console.log(
  `Webhook worker: processed ${result.processed}, delivered ${result.delivered}, retry/failed ${result.failed}.`
)

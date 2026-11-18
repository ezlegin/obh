import { en, type Dictionary } from "@/lib/i18n/en"
import { fa } from "@/lib/i18n/fa"
import type { Locale } from "@/lib/i18n/config"

export type { Dictionary }

const dictionaries: Record<Locale, Dictionary> = { en, fa }

export function getDictionary(locale: Locale) {
  return dictionaries[locale]
}

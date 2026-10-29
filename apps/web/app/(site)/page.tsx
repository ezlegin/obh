import { HomePage } from "@/components/site-pages/home-page"
import { getDictionary } from "@/lib/i18n"

export default function Page() {
  return <HomePage locale="fa" dictionary={getDictionary("fa")} />
}

import { notFound } from "next/navigation"

// Unknown /docs/* paths render the docs 404 inside the docs layout.
export default function MissingDocsPage() {
  notFound()
}

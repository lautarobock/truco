import Link from "next/link"
import { Screen } from "@/components/Screen"
import { buttonPrimary } from "@/components/ui"

export default function NotFound() {
  return (
    <Screen title="No está">
      <p className="text-cream/85">Esa página no existe.</p>
      <Link href="/" className={buttonPrimary}>
        Volver al inicio
      </Link>
    </Screen>
  )
}
